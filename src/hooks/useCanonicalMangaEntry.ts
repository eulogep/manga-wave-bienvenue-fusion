import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveCanonicalDetail, type CanonicalDetailCandidate } from '@/domain/canonicalDetailResolution';
import { getSource, isValidSource, type SourceChapter, type SourceManga, type SourceType } from '@/integrations/sources';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useCanonicalSourceRanking } from '@/hooks/useSourceResolution';

type CanonicalCatalogRow = Database['public']['Views']['canonical_manga_catalog']['Row'];

type CatalogSource = {
  provider?: string;
  external_id?: string;
  available?: boolean;
};

export type CanonicalEntryResolution = {
  source: SourceType;
  mangaId: string;
  manga: SourceManga;
  chapters: SourceChapter[];
  attemptedSources: string[];
};

const parseFallbackCandidates = (catalog: CanonicalCatalogRow | null | undefined): CanonicalDetailCandidate[] => {
  if (!Array.isArray(catalog?.sources)) return [];
  return (catalog.sources as CatalogSource[]).flatMap((mapping, index) => {
    if (!mapping.provider || !mapping.external_id || !isValidSource(mapping.provider)) return [];
    return [{
      sourceId: mapping.provider,
      sourceMangaId: mapping.external_id,
      eligible: mapping.available !== false,
      sourceScore: Math.max(1, 50 - index),
    }];
  });
};

export function useCanonicalMangaEntry(canonicalRouteId: string | undefined, preferredLanguage = 'fr') {
  const numericId = canonicalRouteId && /^\d+$/.test(canonicalRouteId) ? Number(canonicalRouteId) : undefined;
  const catalogQuery = useQuery({
    queryKey: ['canonical-manga-detail', numericId],
    queryFn: async (): Promise<CanonicalCatalogRow | null> => {
      if (numericId === undefined) return null;
      const { data, error } = await supabase
        .from('canonical_manga_catalog')
        .select('*')
        .eq('canonical_id', numericId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: numericId !== undefined,
    staleTime: 5 * 60_000,
  });
  const rankingQuery = useCanonicalSourceRanking(numericId, preferredLanguage);
  const rankedCandidates = useMemo<CanonicalDetailCandidate[]>(() => {
    if (rankingQuery.data?.length) {
      return rankingQuery.data.flatMap((mapping) => (
        isValidSource(mapping.source_id)
          ? [{
              sourceId: mapping.source_id,
              sourceMangaId: mapping.source_manga_id,
              eligible: mapping.eligible,
              sourceScore: Number(mapping.source_score),
            }]
          : []
      ));
    }
    return parseFallbackCandidates(catalogQuery.data);
  }, [catalogQuery.data, rankingQuery.data]);

  const resolutionQuery = useQuery({
    queryKey: ['canonical-manga-resolution', numericId, preferredLanguage, rankedCandidates],
    queryFn: async (): Promise<CanonicalEntryResolution> => {
      const resolved = await resolveCanonicalDetail(rankedCandidates, async (candidate) => {
        const adapter = getSource(candidate.sourceId);
        if (!adapter) throw new Error('Source non reconnue');
        const manga = await adapter.getMangaDetails(candidate.sourceMangaId);
        const chapters = await adapter.getChapters(candidate.sourceMangaId, { language: preferredLanguage, limit: 500 });
        return { manga, chapters };
      });
      return {
        source: resolved.candidate.sourceId as SourceType,
        mangaId: resolved.candidate.sourceMangaId,
        manga: resolved.value.manga,
        chapters: resolved.value.chapters,
        attemptedSources: resolved.attemptedSources,
      };
    },
    enabled: numericId !== undefined
      && !catalogQuery.isLoading
      && !rankingQuery.isLoading
      && rankedCandidates.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return { numericId, catalogQuery, rankingQuery, resolutionQuery };
}

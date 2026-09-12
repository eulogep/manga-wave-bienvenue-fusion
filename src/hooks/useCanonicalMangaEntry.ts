import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveCanonicalDetail, type CanonicalDetailCandidate } from '@/domain/canonicalDetailResolution';
import { getSource, isValidSource, type SourceChapter, type SourceManga, type SourceType } from '@/integrations/sources';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useCanonicalSourceRanking } from '@/hooks/useSourceResolution';

type CanonicalMangaRow = Database['public']['Tables']['mangas']['Row'];
type CanonicalMappingRow = Database['public']['Tables']['manga_source_mappings']['Row'];

export type CanonicalDetailCatalog = {
  canonical_id: number;
  normalized_title: string;
  title: string;
  alternative_titles: string[];
  author: string | null;
  artist: string | null;
  type: string | null;
  status: string;
  cover: string | null;
  description: string | null;
  genres: string[];
  rating: number | null;
  content_rating: string | null;
  country_of_origin: string | null;
  metadata_source: string | null;
  metadata_confidence: string | null;
  metadata_updated_at: string | null;
  source_updated_at: string | null;
  source_count: number;
  sources: CatalogSource[];
};

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

const parseFallbackCandidates = (catalog: CanonicalDetailCatalog | null | undefined): CanonicalDetailCandidate[] => {
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
    queryFn: async (): Promise<CanonicalDetailCatalog | null> => {
      if (numericId === undefined) return null;
      const [mangaResult, mappingsResult] = await Promise.all([
        supabase.from('mangas').select('*').eq('id', numericId).maybeSingle(),
        supabase.from('manga_source_mappings').select('*').eq('manga_id', numericId).order('source_id'),
      ]);
      if (mangaResult.error) throw mangaResult.error;
      if (mappingsResult.error) throw mappingsResult.error;
      const manga = mangaResult.data as CanonicalMangaRow | null;
      if (!manga) return null;
      const mappings = (mappingsResult.data || []) as CanonicalMappingRow[];
      return {
        canonical_id: manga.id,
        normalized_title: manga.normalized_title,
        title: manga.title,
        alternative_titles: manga.aliases || [],
        author: manga.author,
        artist: manga.artist,
        type: manga.manga_type,
        status: manga.status,
        cover: manga.cover_image,
        description: manga.description,
        genres: manga.genre || [],
        rating: manga.rating,
        content_rating: manga.content_rating,
        country_of_origin: manga.country_of_origin,
        metadata_source: manga.metadata_source,
        metadata_confidence: manga.metadata_confidence,
        metadata_updated_at: manga.metadata_updated_at,
        source_updated_at: manga.source_updated_at,
        source_count: mappings.filter((mapping) => mapping.available).length,
        sources: mappings.map((mapping) => ({
          provider: mapping.source_id,
          external_id: mapping.source_manga_id,
          available: mapping.available,
        })),
      };
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

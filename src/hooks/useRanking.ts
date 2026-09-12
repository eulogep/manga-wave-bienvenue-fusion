import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import type { SearchWork } from '@/domain/canonicalSearch';
import {
  assessRankingConfidence,
  rankingLabel,
  RANKING_WINDOW_DAYS,
  type RankingResult,
  type RankingWindow,
} from '@/domain/ranking';

export type RankingItem = RankingResult & {
  work: SearchWork;
  label: string;
};

type RankingRpcRow = {
  canonical_manga_id: number;
  score: number;
  unique_readers: number;
  reading_sessions: number;
  distinct_active_days: number;
  new_follows: number;
  new_favorites: number;
  legacy_fallback: boolean;
  rank: number;
};

const RESULT_LIMIT = 20;

/**
 * Reads the anonymous aggregate ranking from `public.get_manga_ranking`
 * (T-3023, sustained popularity — distinct from T-3022 Trending) and joins
 * it against the already-cached T-3020 canonical snapshot. No raw per-user
 * activity ever reaches the client, and no per-provider network call
 * happens here.
 */
export function useRankingList(window: RankingWindow, includeLegacyFallback = true) {
  const canonicalQuery = useCanonicalSearch(true);

  const rankingQuery = useQuery({
    queryKey: ['manga-ranking', window, includeLegacyFallback],
    staleTime: 60_000,
    queryFn: async (): Promise<RankingResult[]> => {
      const { data, error } = await supabase.rpc('get_manga_ranking', {
        window_days: RANKING_WINDOW_DAYS[window],
        result_limit: RESULT_LIMIT,
        include_legacy_fallback: includeLegacyFallback,
      });
      if (error) throw error;
      return ((data || []) as RankingRpcRow[]).map((row) => ({
        canonicalMangaId: row.canonical_manga_id,
        score: Number(row.score),
        uniqueReaders: row.unique_readers,
        readingSessions: row.reading_sessions,
        distinctActiveDays: row.distinct_active_days,
        newFollows: row.new_follows,
        newFavorites: row.new_favorites,
        legacyFallback: row.legacy_fallback,
        rank: row.rank,
      }));
    },
  });

  const items = useMemo((): RankingItem[] => {
    if (!rankingQuery.data || !canonicalQuery.data) return [];
    const byId = new Map(canonicalQuery.data.map((work) => [work.id, work]));
    return rankingQuery.data.flatMap((result) => {
      const work = byId.get(result.canonicalMangaId);
      return work ? [{ ...result, work, label: rankingLabel(result) }] : [];
    });
  }, [rankingQuery.data, canonicalQuery.data]);

  const confidence = useMemo(() => assessRankingConfidence(rankingQuery.data ?? []), [rankingQuery.data]);

  return {
    items,
    confidence,
    isLoading: rankingQuery.isLoading || canonicalQuery.isLoading,
    isError: rankingQuery.isError || canonicalQuery.isError,
    error: rankingQuery.error || canonicalQuery.error,
    refetch: () => Promise.all([rankingQuery.refetch(), canonicalQuery.refetch()]),
    isFetching: rankingQuery.isFetching || canonicalQuery.isFetching,
  };
}

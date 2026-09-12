import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import type { SearchWork } from '@/domain/canonicalSearch';
import {
  assessTrendingConfidence,
  trendingLabel,
  TRENDING_WINDOW_DAYS,
  type TrendingResult,
  type TrendingWindow,
} from '@/domain/trending';

export type TrendingItem = TrendingResult & {
  work: SearchWork;
  label: string;
};

type TrendingRpcRow = {
  canonical_manga_id: number;
  score: number;
  unique_readers: number;
  reading_sessions: number;
  new_follows: number;
  new_favorites: number;
  rank: number;
};

const RESULT_LIMIT = 20;

/**
 * Reads the anonymous aggregate ranking from `public.get_trending_manga`
 * (no raw per-user activity ever reaches the client) and joins it against the
 * already-cached T-3020 canonical snapshot for display metadata. No
 * per-provider network call happens here.
 */
export function useTrendingRanking(window: TrendingWindow) {
  const canonicalQuery = useCanonicalSearch(true);

  const rankingQuery = useQuery({
    queryKey: ['trending-manga', window],
    staleTime: 60_000,
    queryFn: async (): Promise<TrendingResult[]> => {
      const { data, error } = await supabase.rpc('get_trending_manga', {
        window_days: TRENDING_WINDOW_DAYS[window],
        result_limit: RESULT_LIMIT,
      });
      if (error) throw error;
      return ((data || []) as TrendingRpcRow[]).map((row) => ({
        canonicalMangaId: row.canonical_manga_id,
        score: Number(row.score),
        uniqueReaders: row.unique_readers,
        readingSessions: row.reading_sessions,
        newFollows: row.new_follows,
        newFavorites: row.new_favorites,
        rank: row.rank,
      }));
    },
  });

  const items = useMemo((): TrendingItem[] => {
    if (!rankingQuery.data || !canonicalQuery.data) return [];
    const byId = new Map(canonicalQuery.data.map((work) => [work.id, work]));
    return rankingQuery.data.flatMap((result) => {
      const work = byId.get(result.canonicalMangaId);
      return work ? [{ ...result, work, label: trendingLabel(result.score) }] : [];
    });
  }, [rankingQuery.data, canonicalQuery.data]);

  const confidence = useMemo(() => assessTrendingConfidence(rankingQuery.data ?? []), [rankingQuery.data]);

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

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import type { SearchWork } from '@/domain/canonicalSearch';
import { assessTrendingConfidence, trendingLabel, type TrendingResult } from '@/domain/trending';

export type TrendingItem = TrendingResult & {
  work: SearchWork;
  label: string;
};

type TrendingRow = {
  canonical_manga_id: number;
  score: number;
  unique_users: number;
  follow_events: number;
  favorite_events: number;
  reading_session_events: number;
  progress_update_events: number;
  computed_at: string;
};

const FETCH_LIMIT = 20;

/**
 * Reads the scheduled, materialized, time-decayed Trending aggregate
 * (`public.manga_trending_scores`, refreshed hourly by pg_cron) directly —
 * no RPC wrapper, no live per-request computation, no raw per-user activity
 * ever reaches the client — and joins it against the already-cached T-3020
 * canonical snapshot for display metadata.
 *
 * There is deliberately no window selector here (unlike T-3023 Ranking,
 * which supports discrete 24h/7d/30d/all-time windows over an undecayed
 * aggregate): Trending's score already blends recency continuously via the
 * tiered decay multiplier baked into the materialized view, so a separate
 * "last 24h / last 7d" toggle here would either be redundant with the decay
 * or would require exposing raw per-event ages the view intentionally never
 * stores. One decayed ranking, refreshed hourly, is the whole point.
 */
export function useTrendingRanking() {
  const canonicalQuery = useCanonicalSearch(true);

  const rankingQuery = useQuery({
    queryKey: ['trending-manga-scores'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrendingRow[]> => {
      const { data, error } = await supabase
        .from('manga_trending_scores')
        .select('canonical_manga_id, score, unique_users, follow_events, favorite_events, reading_session_events, progress_update_events, computed_at')
        .order('score', { ascending: false })
        .order('canonical_manga_id', { ascending: true })
        .limit(FETCH_LIMIT);
      if (error) throw error;
      return (data || []) as TrendingRow[];
    },
  });

  const results = useMemo((): TrendingResult[] => (
    (rankingQuery.data ?? []).map((row, index) => ({
      canonicalMangaId: row.canonical_manga_id,
      score: Number(row.score),
      uniqueUsers: row.unique_users,
      followEvents: row.follow_events,
      favoriteEvents: row.favorite_events,
      readingSessionEvents: row.reading_session_events,
      progressUpdateEvents: row.progress_update_events,
      rank: index + 1,
    }))
  ), [rankingQuery.data]);

  const items = useMemo((): TrendingItem[] => {
    if (!canonicalQuery.data) return [];
    const byId = new Map(canonicalQuery.data.map((work) => [work.id, work]));
    return results.flatMap((result) => {
      const work = byId.get(result.canonicalMangaId);
      return work ? [{ ...result, work, label: trendingLabel(result.score) }] : [];
    });
  }, [results, canonicalQuery.data]);

  const confidence = useMemo(() => assessTrendingConfidence(results), [results]);

  return {
    items,
    confidence,
    isLoading: rankingQuery.isLoading || canonicalQuery.isLoading,
    isError: rankingQuery.isError || canonicalQuery.isError,
    error: rankingQuery.error || canonicalQuery.error,
    refetch: () => Promise.all([rankingQuery.refetch(), canonicalQuery.refetch()]),
    isFetching: rankingQuery.isFetching || canonicalQuery.isFetching,
    computedAt: rankingQuery.data?.[0]?.computed_at ?? null,
  };
}

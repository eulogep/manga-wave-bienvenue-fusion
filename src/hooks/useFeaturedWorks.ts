import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTrendingRows, toTrendingResults } from '@/hooks/useTrending';
import type { SearchWork } from '@/domain/canonicalSearch';
import { FEATURED_LIMIT, selectFeaturedWorks } from '@/domain/featuredManga';
import { normalizeWorkMetadata } from '@/domain/genres';
import { assessTrendingConfidence } from '@/domain/trending';

const COLUMNS = 'id,title,aliases,author,genre,manga_type,status,cover_image,rating,views,created_at,content_rating';
/** Spare rows so works that fail selectFeaturedWorks' checks never leave the hero short. */
const RECENT_CANDIDATES = FEATURED_LIMIT + 5;

/**
 * Hero selection without the full canonical catalogue: it reads only trending ids and the most
 * recent eligible works, which is all selectFeaturedWorks can pick from. The hero then paints
 * from ~20 rows instead of waiting for ~1 000 (it was the homepage's LCP bottleneck).
 */
export function useFeaturedWorks() {
  const trendingRows = useTrendingRows();
  const results = useMemo(() => toTrendingResults(trendingRows.data ?? []), [trendingRows.data]);
  const trendingIds = useMemo(
    () => (assessTrendingConfidence(results).confident ? results.map((result) => result.canonicalMangaId) : []),
    [results],
  );

  const candidates = useQuery({
    queryKey: ['featured-candidates', trendingIds.join(',')],
    enabled: !trendingRows.isPending,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SearchWork[]> => {
      const recent = supabase.from('mangas').select(COLUMNS)
        .not('cover_image', 'is', null)
        .or('content_rating.is.null,content_rating.neq.erotica')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(RECENT_CANDIDATES);
      const trending = trendingIds.length
        ? supabase.from('mangas').select(COLUMNS).in('id', trendingIds)
        : Promise.resolve({ data: [], error: null });
      const [recentResult, trendingResult] = await Promise.all([recent, trending]);
      if (recentResult.error) throw recentResult.error;
      if (trendingResult.error) throw trendingResult.error;
      return [...(trendingResult.data || []), ...(recentResult.data || [])].map(normalizeWorkMetadata) as SearchWork[];
    },
  });

  const items = useMemo(() => selectFeaturedWorks(candidates.data || [], trendingIds), [candidates.data, trendingIds]);

  return {
    items,
    isLoading: trendingRows.isPending || candidates.isPending,
    isError: candidates.isError,
    refetch: () => Promise.all([trendingRows.refetch(), candidates.refetch()]),
  };
}

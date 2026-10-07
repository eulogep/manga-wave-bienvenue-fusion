import { useMemo } from 'react';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { useTrendingRanking } from '@/hooks/useTrending';
import { selectFeaturedWorks } from '@/domain/featuredManga';
import FeaturedMangaCarousel from '@/components/FeaturedMangaCarousel';

export default function HeroSection() {
  const catalog = useCanonicalSearch(true);
  const trending = useTrendingRanking();
  const items = useMemo(() => selectFeaturedWorks(catalog.data || [],
    trending.confidence.confident ? trending.items.map((item) => item.work.id) : []),
  [catalog.data, trending.items, trending.confidence.confident]);
  return <FeaturedMangaCarousel items={items} loading={catalog.isLoading}
    failed={catalog.isError} onRetry={() => void catalog.refetch()} />;
}

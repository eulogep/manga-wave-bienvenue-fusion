import { useFeaturedWorks } from '@/hooks/useFeaturedWorks';
import FeaturedMangaCarousel from '@/components/FeaturedMangaCarousel';

export default function HeroSection() {
  const featured = useFeaturedWorks();
  return <FeaturedMangaCarousel items={featured.items} loading={featured.isLoading}
    failed={featured.isError} onRetry={() => void featured.refetch()} />;
}

import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import ContinueReadingSection from '@/components/ContinueReadingSection';
import MultiSourceHubSection from '@/components/MultiSourceHubSection';
import OriginMangaSection from '@/components/OriginMangaSection';
import FeaturedSection from '@/components/FeaturedSection';
import CategoriesSection from '@/components/CategoriesSection';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      <Header />
      <main>
        <HeroSection />
        <ContinueReadingSection />
        <MultiSourceHubSection />
        <OriginMangaSection />
        <FeaturedSection />
        <CategoriesSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;

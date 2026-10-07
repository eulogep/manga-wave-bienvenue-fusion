import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import ContinueReadingSection from '@/components/ContinueReadingSection';
import OriginMangaSection from '@/components/OriginMangaSection';
import FeaturedSection from '@/components/FeaturedSection';
import CategoriesSection from '@/components/CategoriesSection';
import Footer from '@/components/Footer';
import HomeCatalogSections from '@/components/HomeCatalogSections';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--mw-background)] text-white">
      <Header />
      <main>
        {loading ? (
          <section className="flex min-h-[55vh] items-center justify-center bg-[#06101a] text-sm text-[var(--mw-text-secondary)]" aria-live="polite">
            Préparation de Manga Wave…
          </section>
        ) : user ? (
          <>
            <ContinueReadingSection />
            <HomeCatalogSections mode="personalized" />
          </>
        ) : (
          <>
            <HeroSection />
            <OriginMangaSection />
            <HomeCatalogSections mode="anonymous" />
            <FeaturedSection />
            <CategoriesSection />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Index;

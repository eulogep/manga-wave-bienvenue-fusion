
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import ContinueReadingSection from '@/components/ContinueReadingSection';
import FeaturedSection from '@/components/FeaturedSection';
import CategoriesSection from '@/components/CategoriesSection';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <HeroSection />
        <ContinueReadingSection />
        <FeaturedSection />
        <CategoriesSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;

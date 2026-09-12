import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TrendingSection from '@/components/TrendingSection';

const Trending = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14">
        <div className="container mx-auto">
          <section className="mb-8">
            <p className="text-manga-cyan font-semibold tracking-widest text-xs mb-2">COMMUNAUTÉ</p>
            <h1 className="text-4xl md:text-5xl font-bold font-japanese mb-2">
              <span className="glow-text">Tendances</span>
            </h1>
            <p className="text-white/50 text-sm md:text-base max-w-2xl">
              Les mangas qui gagnent le plus d’attention en ce moment sur Manga Wave, d’après la
              lecture, les suivis et les favoris récents des lecteurs — jamais une popularité figée.
              Classement recalculé chaque heure, pondéré par récence (24 h, 7 j, 30 j).{' '}
              <Link to="/ranking" className="text-manga-cyan underline underline-offset-2 hover:text-white">Voir le classement général</Link>.
            </p>
          </section>
          <TrendingSection title="Classement" />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Trending;

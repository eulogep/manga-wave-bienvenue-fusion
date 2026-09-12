import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import RankingSection from '@/components/RankingSection';
import type { RankingWindow } from '@/domain/ranking';

const Ranking = () => {
  const [window, setWindow] = useState<RankingWindow>('30d');

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14">
        <div className="container mx-auto">
          <section className="mb-8">
            <p className="text-manga-cyan font-semibold tracking-widest text-xs mb-2">COMMUNAUTÉ</p>
            <h1 className="text-4xl md:text-5xl font-bold font-japanese mb-2">
              <span className="glow-text">Classement</span>
            </h1>
            <p className="text-white/50 text-sm md:text-base max-w-2xl">
              Les mangas avec l’intérêt le plus durable sur Manga Wave — lecture répétée dans le
              temps, suivis et favoris — pas un pic d’un jour.{' '}
              <Link to="/trending" className="text-manga-cyan underline underline-offset-2 hover:text-white">Voir les tendances du moment</Link>.
            </p>
          </section>
          <RankingSection window={window} onWindowChange={setWindow} showWindowTabs title="Classement général" />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Ranking;

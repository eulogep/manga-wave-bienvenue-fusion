import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Flame, Sparkles } from 'lucide-react';
import MangaCard from './MangaCard';
import { Button } from '@/components/ui/button';
import { usePopularOriginManga } from '@/hooks/useOriginManga';

const OriginMangaSection = () => {
  const { data: mangas, isLoading, isError } = usePopularOriginManga();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollRef.current;
    if (!container) return;
    const amount = container.offsetWidth * 0.75;
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (isError) return null;

  return (
    <section className="py-20 section-padding relative overflow-hidden">
      {/* ── Ambient background ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-0 w-[600px] h-[400px] bg-manga-purple/6 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[350px] bg-manga-pink/5 blur-[120px] rounded-full" />
      </div>

      <div className="container mx-auto relative z-10">

        {/* ── Section Header ── */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            {/* Badges */}
            <div className="flex items-center gap-2 mb-4">
              <span className="badge-vf inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px]">
                <Flame className="h-3 w-3" />
                OriginManga
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-manga-cyan/30 text-manga-cyan bg-manga-cyan/8">
                <Sparkles className="h-3 w-3" />
                Lecture Directe
              </span>
            </div>
            <h2 className="font-outfit font-bold text-3xl md:text-4xl text-white">
              Scans <span className="glow-text">Français</span>
            </h2>
            <p className="text-white/40 mt-2 text-sm max-w-lg">
              Lisez les derniers chapitres traduits en français directement dans votre navigateur, avec le lecteur intégré multi-modes.
            </p>
          </div>

          {/* Nav + CTA */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <button
                onClick={() => scroll('left')}
                aria-label="Défiler vers la gauche"
                className="h-9 w-9 rounded-full border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => scroll('right')}
                aria-label="Défiler vers la droite"
                className="h-9 w-9 rounded-full border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="btn-outline-glow rounded-full px-5 text-sm"
              asChild
            >
              <Link to="/search?source=originmanga">
                Voir tout
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* ── Horizontal Carousel ── */}
        {isLoading ? (
          <div className="flex gap-4 pb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-40 sm:w-48 aspect-[3/4] cover-skeleton rounded-xl" />
            ))}
          </div>
        ) : mangas && mangas.length > 0 ? (
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 scroll-smooth"
          >
            {mangas.map((manga, index) => (
              <div
                key={manga.id}
                className="shrink-0 w-40 sm:w-48 animate-slide-up-fade"
                style={{ animationDelay: `${index * 0.07}s`, opacity: 0 }}
              >
                <div className="relative">
                  {/* VF badge */}
                  <span className="absolute z-10 top-2 left-2 badge-vf px-2 py-0.5 rounded-full text-[9px] tracking-widest">VF</span>
                  <MangaCard
                    id={manga.id}
                    title={manga.title}
                    author="OriginManga"
                    status="ongoing"
                    genre={['VF']}
                    imageUrl={manga.coverUrl}
                    lastUpdate="Lecture in-app"
                    externalUrl={manga.url}
                    detailUrl={`/manga/${manga.id}?source=originmanga`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* ── Reader Banner CTA ── */}
        <div className="mt-10 relative rounded-2xl overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-manga-purple/25 via-[#0f1520] to-manga-cyan/15" />
          <div className="absolute inset-0 border border-white/[0.06] rounded-2xl" />
          {/* Glow accent */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-manga-purple/20 blur-[60px] rounded-full" />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-manga-purple/20 border border-manga-purple/30 shrink-0 shadow-glow-purple">
                <BookOpen className="h-6 w-6 text-manga-purple" />
              </div>
              <div>
                <h3 className="font-outfit font-bold text-lg text-white">Lecteur Multi-Modes</h3>
                <p className="text-sm text-white/45 mt-0.5 max-w-md">
                  Mode page par page ou défilement Webtoon — navigation clavier incluse.
                </p>
              </div>
            </div>
            <Button className="btn-gradient shrink-0 px-6 h-11 rounded-full font-semibold" asChild>
              <Link to="/search?source=originmanga">
                Commencer la lecture
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OriginMangaSection;

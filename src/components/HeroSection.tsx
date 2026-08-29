import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import MangaCover from '@/components/MangaCover';
import { usePopularOriginManga } from '@/hooks/useOriginManga';

const HeroSection = () => {
  const { data: mangas = [], isLoading } = usePopularOriginManga();
  const featured = useMemo(() => mangas.slice(0, 4), [mangas]);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = featured[activeIndex] || featured[0];

  useEffect(() => {
    if (featured.length < 2) return;
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % featured.length);
    }, 7_000);
    return () => window.clearInterval(interval);
  }, [featured.length]);

  useEffect(() => {
    if (activeIndex >= featured.length && featured.length > 0) setActiveIndex(0);
  }, [activeIndex, featured.length]);

  const move = (direction: -1 | 1) => {
    if (featured.length === 0) return;
    setActiveIndex((index) => (index + direction + featured.length) % featured.length);
  };

  return (
    <section className="relative isolate min-h-[660px] overflow-hidden border-b border-[var(--mw-border)] bg-[#06101a] lg:min-h-[720px]" aria-label="Manga à la une">
      {active?.coverUrl && (
        <div className="absolute inset-y-0 right-0 w-full overflow-hidden md:w-[68%]" aria-hidden="true">
          <MangaCover src={active.coverUrl} alt="" className="h-full w-full scale-[1.03] object-cover object-top opacity-75 transition-all duration-700" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#06101a_2%,rgba(6,16,26,.93)_20%,rgba(6,16,26,.34)_64%,rgba(6,16,26,.55)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,#06101a_0%,transparent_42%,rgba(6,16,26,.3)_100%)]" />
        </div>
      )}

      <div className="absolute inset-0 opacity-[0.14]" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px)', backgroundSize: '100% 72px' }} />

      <div className="container relative z-10 mx-auto flex min-h-[660px] items-end px-4 pb-8 pt-20 sm:px-6 md:items-center md:pb-16 lg:min-h-[720px] lg:px-8">
        <div className="grid w-full items-end gap-8 md:grid-cols-[minmax(0,560px)_1fr] lg:gap-14">
          <div className="pb-2 md:pb-0">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-10 bg-[var(--mw-accent-coral)]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mw-accent-coral)]">Sélection de la rédaction</p>
            </div>

            <h1 className="font-editorial text-4xl font-semibold uppercase leading-[1.04] text-[var(--mw-text-primary)] sm:text-5xl lg:text-6xl">
              {active?.title || 'Les récits qui laissent une trace'}
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-[var(--mw-text-secondary)]">
              <span className="border border-[var(--mw-accent-coral)]/45 bg-[var(--mw-accent-coral)]/10 px-2 py-1 text-[var(--mw-accent-coral)]">Scan français</span>
              <span>OriginManga</span>
              {active?.rating && <span>★ {active.rating.toFixed(1)}</span>}
            </div>

            <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--mw-text-secondary)] sm:text-base">
              Entrez dans une sélection de mangas pensée pour la lecture : des œuvres fortes, leurs derniers chapitres et un lecteur immersif qui s’efface devant l’histoire.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={active ? `/manga/${active.id}?source=originmanga` : '/search?source=originmanga'} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--mw-accent-coral)] px-6 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#ff6671]">
                <BookOpen className="h-4 w-4" /> Découvrir ce manga
              </Link>
              <Link to="/search" className="inline-flex min-h-12 items-center justify-center gap-2 border border-[var(--mw-border)] bg-[#0c1722]/80 px-6 text-sm font-semibold text-[var(--mw-text-primary)] transition-colors hover:border-[var(--mw-accent-blue)]">
                Explorer le catalogue <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="hidden self-end md:block">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--mw-text-secondary)]">À l’affiche</p>
              <div className="flex gap-1">
                <button onClick={() => move(-1)} className="flex h-10 w-10 items-center justify-center border border-[var(--mw-border)] bg-[#06101a]/80 text-white hover:border-white/40" aria-label="Sélection précédente"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => move(1)} className="flex h-10 w-10 items-center justify-center border border-[var(--mw-border)] bg-[#06101a]/80 text-white hover:border-white/40" aria-label="Sélection suivante"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(isLoading ? Array.from({ length: 4 }) : featured).map((manga, index) => (
                <button key={typeof manga === 'object' ? manga.id : index} onClick={() => setActiveIndex(index)} className={`relative aspect-[3/4] overflow-hidden border text-left transition-all ${index === activeIndex ? 'border-[var(--mw-accent-coral)] opacity-100' : 'border-[var(--mw-border)] opacity-55 hover:opacity-90'}`} aria-label={typeof manga === 'object' ? `Afficher ${manga.title}` : 'Chargement'}>
                  {typeof manga === 'object' ? <MangaCover src={manga.coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full animate-pulse bg-[var(--mw-surface)]" />}
                  <span className="absolute bottom-1 left-1 font-editorial text-xl text-white/90">0{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

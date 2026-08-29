import { ArrowRight, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import MangaCover from '@/components/MangaCover';
import { usePopularOriginManga } from '@/hooks/useOriginManga';

const OriginMangaSection = () => {
  const { data: mangas = [], isLoading, isError } = usePopularOriginManga();
  if (isError) return null;

  return (
    <section className="bg-[#06101a] py-14 section-padding" aria-labelledby="trending-title">
      <div className="container mx-auto">
        <div className="mb-7 flex items-end justify-between gap-6">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--mw-accent-coral)]"><Flame className="h-3.5 w-3.5" /> Classement éditorial</p>
            <h2 id="trending-title" className="font-editorial text-3xl uppercase text-[var(--mw-text-primary)] md:text-4xl">Tendances du moment</h2>
          </div>
          <Link to="/search?source=originmanga" className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--mw-text-secondary)] transition-colors hover:text-white sm:flex">Voir tout <ArrowRight className="h-4 w-4" /></Link>
        </div>

        <div className="flex snap-x gap-3 overflow-x-auto pb-3 hide-scrollbar lg:grid lg:grid-cols-5 lg:overflow-visible">
          {(isLoading ? Array.from({ length: 5 }, () => null) : mangas.slice(0, 5)).map((manga, index) => (
            <Link key={manga ? manga.id : index} to={manga ? `/manga/${manga.id}?source=originmanga` : '#'} className="group relative min-w-[190px] snap-start overflow-hidden border border-[var(--mw-border)] bg-[var(--mw-surface)] transition-colors hover:border-[var(--mw-accent-coral)] lg:min-w-0">
              <div className="relative aspect-[3/4] overflow-hidden">
                {manga ? <MangaCover src={manga.coverUrl} alt={`Couverture de ${manga.title}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" /> : <div className="h-full w-full animate-pulse bg-[var(--mw-elevated)]" />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#06101a] via-transparent to-transparent" />
                <span className="absolute bottom-[-9px] left-2 font-editorial text-6xl font-semibold leading-none text-[var(--mw-accent-coral)]">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <div className="min-h-24 border-t border-[var(--mw-border)] px-3 py-3">
                <h3 className="line-clamp-2 font-editorial text-sm font-semibold uppercase leading-5 text-white">{manga ? manga.title : 'Chargement'}</h3>
                <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--mw-text-secondary)]">
                  <span>Scan français</span>
                  {manga?.rating ? <span className="text-manga-gold">★ {manga.rating.toFixed(1)}</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OriginMangaSection;

import { Flame, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import MangaCover from '@/components/MangaCover';
import { useTrendingRanking } from '@/hooks/useTrending';
import type { TrendingWindow } from '@/domain/trending';
import { discoveryStatusLabel, discoveryTypeBadgeClass } from '@/domain/discoveryPresentation';

const WINDOW_LABELS: Record<TrendingWindow, string> = {
  '24h': '24 h',
  '7d': '7 jours',
  '30d': '30 jours',
};

export type TrendingSectionProps = {
  window: TrendingWindow;
  onWindowChange?: (window: TrendingWindow) => void;
  limit?: number;
  showWindowTabs?: boolean;
  title?: string;
};

const EMPTY_COPY = 'Pas encore assez d’activité récente pour établir un classement.';

const TrendingSection = ({
  window,
  onWindowChange,
  limit,
  showWindowTabs = false,
  title = 'Tendances',
}: TrendingSectionProps) => {
  const { items, confidence, isLoading, isError, refetch, isFetching } = useTrendingRanking(window);
  const visible = confidence.confident
    ? (limit ? items.slice(0, limit) : items)
    : [];

  return (
    <section aria-labelledby="trending-heading">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <h2 id="trending-heading" className="flex items-center gap-2 text-xl md:text-2xl font-bold font-outfit text-white">
          <Flame className="h-5 w-5 text-[var(--mw-accent-coral)]" aria-hidden="true" />
          {title}
        </h2>
        {showWindowTabs && onWindowChange && (
          <div role="tablist" aria-label="Période des tendances" className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.05] border border-white/[0.08] self-start">
            {(Object.keys(WINDOW_LABELS) as TrendingWindow[]).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={window === option}
                onClick={() => onWindowChange(option)}
                className={`min-h-9 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  window === option ? 'bg-manga-purple text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {WINDOW_LABELS[option]}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" aria-busy="true" aria-live="polite">
          {Array.from({ length: limit ?? 6 }, (_, index) => (
            <div key={index} className="aspect-[3/4] rounded-2xl bg-white/[0.05] animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-white/60 mb-4">Impossible de charger les tendances pour le moment.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-gradient rounded-full px-5 py-2 text-xs font-semibold"
          >
            Réessayer
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-10 px-6 text-center">
          <TrendingUp className="h-8 w-8 text-white/30 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-white/50 max-w-sm mx-auto">{EMPTY_COPY}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {visible.map((item) => (
            <Link
              key={item.canonicalMangaId}
              to={`/manga/${item.canonicalMangaId}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1520]/80 shadow-card transition-all duration-300 hover:border-manga-purple/40 hover:shadow-card-hover"
              aria-label={`#${item.rank} ${item.work.title}, ${item.label}`}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-black/40">
                <MangaCover
                  src={item.work.cover_image}
                  alt={`Couverture de ${item.work.title}`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
                <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white">
                  #{item.rank}
                </span>
                {item.work.manga_type && (
                  <span className={`absolute right-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${discoveryTypeBadgeClass(item.work.manga_type)}`}>
                    {item.work.manga_type}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 min-h-10 font-outfit text-sm font-semibold text-white">{item.work.title}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--mw-accent-coral)]">{item.label}</span>
                  {item.work.status && (
                    <span className="text-[10px] text-white/40">{discoveryStatusLabel(item.work.status)}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

export default TrendingSection;

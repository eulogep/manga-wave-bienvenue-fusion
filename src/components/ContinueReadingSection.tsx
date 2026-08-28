import { ArrowRight, BookOpen, Clock3, Flame, History, Play, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MangaCover from '@/components/MangaCover';
import { useContinueReading, removeLocalHistoryItem, clearLocalHistory } from '@/hooks/useReadingProgress';

const relativeDate = (value: string) => {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(delta / 60_000));
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `Il y a ${days} j`;
  return new Date(value).toLocaleDateString('fr-FR');
};

const SOURCE_BADGES: Record<string, { label: string; cls: string }> = {
  originmanga: { label: 'OriginManga (VF)', cls: 'badge-vf' },
  crunchyscan: { label: 'CrunchyScan (VF)', cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
  comick: { label: 'Comick.io', cls: 'bg-manga-purple/25 text-manga-purple-light border border-manga-purple/40' },
  mangadex: { label: 'MangaDex', cls: 'bg-manga-cyan/20 text-manga-cyan border border-manga-cyan/30' },
};

const ContinueReadingSection = () => {
  const { data: items = [], isLoading } = useContinueReading();

  // If no items and not loading, we can show a subtle placeholder or hide if clean
  if (!isLoading && items.length === 0) {
    return null; // Keep home clean if no history
  }

  const handleRemove = (e: React.MouseEvent, source: string, mangaId: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeLocalHistoryItem(source, mangaId);
  };

  return (
    <section className="py-12 section-padding relative" aria-labelledby="continue-reading-title">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-manga-cyan animate-badge-pulse" />
              <p className="text-xs font-bold uppercase tracking-widest text-manga-cyan">REPRISE INSTANTANÉE</p>
            </div>
            <h2 id="continue-reading-title" className="text-2xl md:text-3xl font-bold font-outfit text-white">
              Continuer la <span className="glow-text">lecture</span>
            </h2>
            <p className="text-xs md:text-sm text-white/50 mt-1">
              Reprenez directement à la dernière page lue, synchronisée sur toutes vos sources.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <button
                onClick={() => clearLocalHistory()}
                className="text-xs text-white/40 hover:text-manga-pink transition-colors inline-flex items-center gap-1"
                title="Effacer tout l'historique"
              >
                <Trash2 className="h-3 w-3" />
                Effacer
              </button>
            )}
            <Button variant="ghost" size="sm" className="btn-outline-glow rounded-full text-xs" asChild>
              <Link to="/library">
                Ma bibliothèque <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Carousel / Grid of continuing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.slice(0, 4).map((item, index) => {
            const badge = SOURCE_BADGES[item.source] || { label: item.source.toUpperCase(), cls: 'bg-white/10 text-white/70' };
            const resumeUrl = `/read/${encodeURIComponent(item.source)}/${encodeURIComponent(item.mangaId)}/${encodeURIComponent(item.chapterId)}?page=${item.pageIndex || 0}`;

            return (
              <article
                key={`${item.source}-${item.mangaId}`}
                className="group relative rounded-2xl border border-white/[0.08] bg-[#0f1520]/80 hover:bg-[#0f1520] hover:border-manga-purple/40 backdrop-blur-md transition-all duration-300 shadow-card hover:shadow-card-hover overflow-hidden animate-slide-up-fade"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Progress bar at top of card */}
                <div className="h-1 w-full bg-white/[0.05]">
                  <div
                    className="h-full bg-gradient-to-r from-manga-purple to-manga-cyan transition-all duration-300"
                    style={{ width: `${Math.max(5, item.progressPercent || 0)}%` }}
                  />
                </div>

                <div className="flex gap-3.5 p-3.5">
                  {/* Cover */}
                  <div className="relative w-20 h-28 shrink-0 rounded-xl overflow-hidden bg-black/40 shadow-md">
                    <MangaCover
                      src={item.coverImage || null}
                      alt={`Couverture de ${item.mangaTitle}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${badge.cls}`}>
                      {badge.label.split(' ')[0]}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          to={`/manga/${item.mangaId}?source=${item.source}`}
                          className="font-outfit font-bold text-sm text-white line-clamp-1 hover:text-manga-purple transition-colors"
                          title={item.mangaTitle}
                        >
                          {item.mangaTitle}
                        </Link>
                        <button
                          onClick={(e) => handleRemove(e, item.source, item.mangaId)}
                          className="text-white/30 hover:text-white hover:bg-white/10 rounded p-1 transition-colors -mr-1 -mt-1"
                          title="Retirer de la liste"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      <p className="text-xs text-white/40 truncate mt-0.5">
                        {item.mangaAuthor || 'Auteur inconnu'}
                      </p>

                      <p className="text-xs text-manga-cyan font-medium truncate mt-1.5">
                        Chapitre {item.chapterNumber}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-white/40 mt-1">
                        <span>
                          {item.totalPages > 1
                            ? `Page ${(item.pageIndex || 0) + 1}/${item.totalPages}`
                            : 'En cours'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px]">
                          <Clock3 className="h-2.5 w-2.5" />
                          {relativeDate(item.readAt)}
                        </span>
                      </div>
                    </div>

                    {/* Resume CTA button */}
                    <Button
                      size="sm"
                      className="btn-gradient h-7 text-xs font-semibold rounded-lg w-full mt-2"
                      asChild
                    >
                      <Link to={resumeUrl}>
                        <Play className="h-3 w-3 mr-1 fill-white" />
                        Reprendre
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ContinueReadingSection;

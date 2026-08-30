import { ArrowRight, BookOpen, Clock3, Play, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import MangaCover from '@/components/MangaCover';
import { useContinueReading, useReadingHistoryActions } from '@/hooks/useReadingProgress';
import { buildReaderLocation } from '@/domain/readerNavigation';

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

const ContinueReadingSection = () => {
  const { data: items = [], isLoading } = useContinueReading();
  const historyActions = useReadingHistoryActions();

  const handleRemove = (event: React.MouseEvent, canonicalKey: string) => {
    event.preventDefault();
    event.stopPropagation();
    void historyActions.remove(canonicalKey);
  };

  return (
    <section className="relative bg-[#08131d] py-12 section-padding" aria-labelledby="continue-reading-title">
      <div className="container mx-auto border-y border-[var(--mw-border)] py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--mw-accent-coral)]">
              Votre lecture
            </p>
            <h2 id="continue-reading-title" className="font-editorial text-2xl uppercase text-[var(--mw-text-primary)] md:text-3xl">
              Continuer la lecture
            </h2>
            <p className="mt-1 text-sm text-[var(--mw-text-secondary)]">
              Reprenez exactement au chapitre et à la page où vous vous êtes arrêté.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs text-[var(--mw-text-secondary)] transition-colors hover:text-[var(--mw-accent-coral)]">
                    <Trash2 className="h-3.5 w-3.5" />
                    Effacer
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-[var(--mw-border)] bg-[var(--mw-elevated)] text-[var(--mw-text-primary)]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Effacer l’historique récent ?</AlertDialogTitle>
                    <AlertDialogDescription className="text-[var(--mw-text-secondary)]">
                      Les positions enregistrées sur cet appareil seront supprimées. Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void historyActions.clear()} className="bg-[var(--mw-accent-coral)] text-white hover:bg-[var(--mw-accent-coral)]/90">
                      Tout effacer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" size="sm" className="min-h-11 border-[var(--mw-border)] bg-transparent text-xs text-[var(--mw-text-primary)] hover:border-[var(--mw-accent-blue)]" asChild>
              <Link to="/library">
                Ma bibliothèque <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {!isLoading && items.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-[var(--mw-border)] bg-[var(--mw-background)] px-6 text-center">
            <BookOpen className="mb-3 h-6 w-6 text-[var(--mw-accent-blue)]" />
            <p className="font-medium text-[var(--mw-text-primary)]">Aucune lecture récente</p>
            <p className="mt-1 text-sm text-[var(--mw-text-secondary)]">Commencez un chapitre : il apparaîtra ici automatiquement.</p>
            <Button className="mt-4 bg-[var(--mw-accent-coral)] text-white hover:bg-[var(--mw-accent-coral)]/90" asChild>
              <Link to="/search">Découvrir le catalogue</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy={isLoading}>
            {items.slice(0, 4).map((item) => {
              const resumeUrl = buildReaderLocation({
                source: item.source,
                mangaId: item.mangaId,
                chapterId: item.chapterId,
                language: item.language || 'fr',
                pageIndex: item.pageIndex || 0,
                mangaTitle: item.mangaTitle,
                mangaAuthor: item.mangaAuthor,
              });
              const canonicalKey = item.canonicalKey || `title:${item.mangaTitle.toLowerCase()}`;

              return (
                <article key={canonicalKey} className="group relative overflow-hidden border border-[var(--mw-border)] bg-[#0b1722] transition-colors hover:border-[var(--mw-accent-coral)]">
                  <div className="h-1 w-full bg-[var(--mw-border)]">
                    <div className="h-full bg-[var(--mw-accent-coral)]" style={{ width: `${Math.max(3, item.progressPercent || 0)}%` }} />
                  </div>

                  <div className="flex gap-3.5 p-3.5">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden bg-[var(--mw-elevated)]">
                      <MangaCover src={item.coverImage || null} alt={`Couverture de ${item.mangaTitle}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <Link to={`/manga/${item.mangaId}?source=${item.source}`} className="line-clamp-1 text-sm font-bold text-[var(--mw-text-primary)] transition-colors hover:text-[var(--mw-accent-coral)]" title={item.mangaTitle}>
                            {item.mangaTitle}
                          </Link>
                          <button onClick={(event) => handleRemove(event, canonicalKey)} className="-mr-1 -mt-1 flex min-h-11 min-w-11 items-center justify-center text-[var(--mw-text-secondary)] transition-colors hover:text-[var(--mw-text-primary)]" aria-label={`Retirer ${item.mangaTitle} de l’historique`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--mw-accent-blue)]">
                          Lecture {item.language?.toUpperCase() || 'FR'}
                        </p>
                        <p className="mt-1.5 truncate text-xs font-medium text-[var(--mw-text-primary)]">Chapitre {item.chapterNumber}</p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--mw-text-secondary)]">
                          <span>{item.totalPages > 1 ? `Page ${(item.pageIndex || 0) + 1}/${item.totalPages}` : 'En cours'}</span>
                          <span className="font-semibold text-[var(--mw-accent-coral)]">{item.progressPercent}%</span>
                        </div>
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--mw-text-secondary)]"><Clock3 className="h-2.5 w-2.5" />{relativeDate(item.readAt)}</span>
                      </div>

                      <Button size="sm" className="mt-2 h-8 w-full bg-[var(--mw-accent-coral)] text-xs font-semibold text-white hover:bg-[var(--mw-accent-coral)]/90" asChild>
                        <Link to={resumeUrl}><Play className="mr-1 h-3 w-3 fill-current" />Reprendre</Link>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ContinueReadingSection;

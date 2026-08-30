import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Heart,
  History,
  LibraryBig,
  Play,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCard from '@/components/MangaCard';
import MangaCover from '@/components/MangaCover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useLibrary } from '@/hooks/useLibrary';
import {
  useContinueReading,
  removeLocalHistoryItem,
  clearLocalHistory,
} from '@/hooks/useReadingProgress';
import type { MangaDexStatus } from '@/integrations/mangadex/client';
import { canonicalProgressKey } from '@/domain/canonicalProgress';
import { buildReaderLocation } from '@/domain/readerNavigation';
import { useFollowedChapterUpdates } from '@/hooks/useFollowedChapterUpdates';

const PAGE_SIZE = 12;

type SortOption = 'recent' | 'title' | 'rating' | 'updated';
type TabOption = 'favorites' | 'history';

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

const Library = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabOption>('favorites');
  const { data: library = [], isLoading, isError, error, refetch, isFetching } = useLibrary();
  const { data: historyItems = [] } = useContinueReading();
  const { data: followedUpdates = [] } = useFollowedChapterUpdates();
  const followedUpdatesByManga = useMemo(
    () => new Map(followedUpdates.map((update) => [update.manga.id, update])),
    [followedUpdates],
  );

  const [genre, setGenre] = useState('all');
  const [status, setStatus] = useState<'all' | MangaDexStatus>('all');
  const [sort, setSort] = useState<SortOption>('recent');
  const [page, setPage] = useState(0);

  const genres = useMemo(
    () => [...new Set(library.flatMap((manga) => manga.genre))].sort((left, right) => left.localeCompare(right, 'fr')),
    [library],
  );

  const filteredLibrary = useMemo(() => {
    const next = library.filter((manga) => {
      const matchesGenre = genre === 'all' || manga.genre.includes(genre);
      const matchesStatus = status === 'all' || manga.status === status;
      return matchesGenre && matchesStatus;
    });

    return [...next].sort((left, right) => {
      if (sort === 'title') return left.title.localeCompare(right.title, 'fr');
      if (sort === 'rating') return (right.rating || 0) - (left.rating || 0);
      if (sort === 'updated') return new Date(right.source_updated_at || right.created_at).getTime() - new Date(left.source_updated_at || left.created_at).getTime();
      return new Date(right.favoritedAt).getTime() - new Date(left.favoritedAt).getTime();
    });
  }, [genre, library, sort, status]);

  const totalPages = Math.max(1, Math.ceil(filteredLibrary.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleMangas = filteredLibrary.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [genre, status, sort]);

  if (loading || (isLoading && activeTab === 'favorites')) {
    return (
      <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
        <Header />
        <main className="flex-1 section-padding py-12" aria-busy="true" aria-live="polite">
          <div className="container mx-auto animate-pulse space-y-8">
            <div className="h-10 rounded-xl bg-white/10 max-w-sm" />
            <div className="h-24 rounded-2xl bg-white/5" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[3/4] rounded-2xl bg-white/10" />)}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14">
        <div className="container mx-auto">
          {/* Header */}
          <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
            <div>
              <p className="text-manga-cyan font-semibold tracking-widest text-xs mb-2">ESPACE PERSONNEL</p>
              <h1 className="text-4xl md:text-5xl font-bold font-japanese mb-2">
                Ma <span className="glow-text">Bibliothèque</span>
              </h1>
              <p className="text-white/50 text-sm md:text-base">
                Retrouvez vos mangas favoris et reprenez vos lectures où vous vous êtes arrêté.
              </p>
            </div>

            {/* Tab switchers */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.05] border border-white/[0.08] self-start lg:self-auto">
              <button
                onClick={() => setActiveTab('favorites')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'favorites'
                    ? 'bg-manga-purple text-white shadow-glow-purple'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Heart className="h-4 w-4" />
                Favoris ({library.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'history'
                    ? 'bg-manga-purple text-white shadow-glow-purple'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <History className="h-4 w-4" />
                Historique ({historyItems.length})
              </button>
            </div>
          </section>

          {/* TAB 1: FAVORITES */}
          {activeTab === 'favorites' && (
            <>
              {!user ? (
                <section className="rounded-3xl border border-manga-purple/30 bg-gradient-to-br from-manga-purple/15 to-manga-cyan/5 p-8 md:p-12 text-center max-w-2xl mx-auto my-8">
                  <Heart className="h-12 w-12 text-manga-pink mx-auto mb-4" />
                  <h2 className="text-2xl font-bold font-outfit mb-2">Synchronisez vos favoris</h2>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">
                    Connectez-vous pour ajouter des mangas à vos favoris et les retrouver sur tous vos appareils.
                  </p>
                  <Button className="btn-gradient rounded-full px-8" asChild>
                    <Link to="/auth">Se connecter</Link>
                  </Button>
                </section>
              ) : isError ? (
                <section className="container mx-auto max-w-xl text-center rounded-2xl border border-destructive/40 bg-destructive/10 p-8">
                  <h2 className="text-xl font-bold mb-2">Bibliothèque indisponible</h2>
                  <p className="text-white/60 mb-6 text-sm">{error.message}</p>
                  <Button className="btn-gradient" onClick={() => refetch()} disabled={isFetching}>Réessayer</Button>
                </section>
              ) : (
                <>
                  <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-8">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                      <div className="flex items-center gap-2 text-xs text-white/50 shrink-0">
                        <SlidersHorizontal className="h-4 w-4 text-manga-cyan" /> Filtres
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                        <Select value={genre} onValueChange={setGenre}>
                          <SelectTrigger className="bg-[#0f1520] border-white/15 text-white">
                            <Filter className="h-3.5 w-3.5 mr-2 text-white/40" />
                            <SelectValue placeholder="Genre" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0f1520] border-white/20 max-h-64 text-white">
                            <SelectItem value="all">Tous les genres</SelectItem>
                            {genres.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={status} onValueChange={(value) => setStatus(value as 'all' | MangaDexStatus)}>
                          <SelectTrigger className="bg-[#0f1520] border-white/15 text-white">
                            <SelectValue placeholder="Statut" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0f1520] border-white/20 text-white">
                            <SelectItem value="all">Tous statuts</SelectItem>
                            <SelectItem value="ongoing">En cours</SelectItem>
                            <SelectItem value="completed">Terminé</SelectItem>
                            <SelectItem value="hiatus">En pause</SelectItem>
                            <SelectItem value="cancelled">Annulé</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
                          <SelectTrigger className="bg-[#0f1520] border-white/15 text-white">
                            <SelectValue placeholder="Trier" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0f1520] border-white/20 text-white">
                            <SelectItem value="recent">Ajoutés récemment</SelectItem>
                            <SelectItem value="title">Titre A → Z</SelectItem>
                            <SelectItem value="rating">Meilleures notes</SelectItem>
                            <SelectItem value="updated">Dernière mise à jour</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>

                  {library.length === 0 ? (
                    <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-16 px-6 text-center">
                      <LibraryBig className="h-12 w-12 text-manga-purple mx-auto mb-4 opacity-70" />
                      <h2 className="text-xl font-bold mb-2">Votre bibliothèque est encore vide</h2>
                      <p className="text-white/50 max-w-md mx-auto text-sm mb-6">
                        Ajoutez des mangas à vos favoris en cliquant sur l'icône cœur pour les retrouver ici.
                      </p>
                      <Button className="btn-gradient rounded-full px-6" asChild>
                        <Link to="/search">Explorer le catalogue</Link>
                      </Button>
                    </section>
                  ) : filteredLibrary.length === 0 ? (
                    <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-14 px-6 text-center">
                      <Filter className="h-10 w-10 text-manga-cyan mx-auto mb-3" />
                      <h2 className="text-lg font-bold mb-2">Aucun favori ne correspond aux filtres</h2>
                      <Button variant="outline" className="border-white/20 mt-3" onClick={() => { setGenre('all'); setStatus('all'); setSort('recent'); }}>
                        Réinitialiser les filtres
                      </Button>
                    </section>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-6 text-xs text-white/50">
                        <span>{filteredLibrary.length} titre{filteredLibrary.length > 1 ? 's' : ''}</span>
                        <span>Page {currentPage + 1} / {totalPages}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {visibleMangas.map((manga, index) => {
                          const update = followedUpdatesByManga.get(manga.id);
                          const updateUrl = update ? buildReaderLocation({
                            source: update.latestChapter.provider,
                            mangaId: update.latestChapter.providerMangaId,
                            chapterId: update.latestChapter.providerChapterId,
                            language: update.latestChapter.language,
                            pageIndex: 0,
                            mangaTitle: manga.title,
                            mangaAuthor: manga.author,
                          }) : null;
                          return (
                          <div key={manga.id} className="animate-slide-up-fade" style={{ animationDelay: `${index * 0.05}s` }}>
                            <MangaCard
                              id={manga.id}
                              favoriteId={manga.id}
                              isFavorite
                              title={manga.title}
                              author={manga.author || 'Auteur inconnu'}
                              rating={manga.rating}
                              status={manga.status as MangaDexStatus}
                              genre={manga.genre}
                              imageUrl={manga.cover_image}
                              lastUpdate={new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(new Date(manga.source_updated_at || manga.created_at))}
                              detailUrl={`/manga/${manga.id}`}
                              externalUrl={manga.mangadex_id ? `https://mangadex.org/title/${manga.mangadex_id}` : undefined}
                              newChapterCount={update?.newChapterCount}
                            />
                            {updateUrl && (
                              <Button className="mt-2 h-10 w-full bg-[var(--mw-accent-coral)] text-xs font-bold uppercase text-white" asChild>
                                <Link to={updateUrl}>Lire le chapitre {update.latestChapter.chapterNumber}</Link>
                              </Button>
                            )}
                          </div>
                          );
                        })}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-10">
                          <Button variant="outline" size="icon" className="border-white/20" disabled={currentPage === 0} onClick={() => setPage((v) => Math.max(0, v - 1))}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-white/60">{currentPage + 1} / {totalPages}</span>
                          <Button variant="outline" size="icon" className="border-white/20" disabled={currentPage >= totalPages - 1} onClick={() => setPage((v) => Math.min(totalPages - 1, v + 1))}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB 2: READING HISTORY */}
          {activeTab === 'history' && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-white/60">
                  {historyItems.length} titre{historyItems.length > 1 ? 's' : ''} dans votre historique de lecture
                </p>
                {historyItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/40 hover:text-manga-pink"
                    onClick={() => clearLocalHistory()}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Effacer tout l'historique
                  </Button>
                )}
              </div>

              {historyItems.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-16 px-6 text-center">
                  <History className="h-12 w-12 text-manga-purple mx-auto mb-4 opacity-70" />
                  <h2 className="text-xl font-bold mb-2">Aucun historique de lecture</h2>
                  <p className="text-white/50 max-w-md mx-auto text-sm mb-6">
                    Lorsque vous commencez un chapitre, votre progression est automatiquement sauvegardée ici.
                  </p>
                  <Button className="btn-gradient rounded-full px-6" asChild>
                    <Link to="/search">Découvrir des mangas</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {historyItems.map((item, index) => {
                    const resumeUrl = `/read/${encodeURIComponent(item.source)}/${encodeURIComponent(item.mangaId)}/${encodeURIComponent(item.chapterId)}?page=${item.pageIndex || 0}`;
                    const canonicalKey = item.canonicalKey || canonicalProgressKey(item.mangaTitle);

                    return (
                      <article
                        key={canonicalKey}
                        className="group relative rounded-2xl border border-white/[0.08] bg-[#0f1520]/80 hover:bg-[#0f1520] hover:border-manga-purple/40 backdrop-blur-md transition-all duration-300 shadow-card hover:shadow-card-hover overflow-hidden animate-slide-up-fade"
                        style={{ animationDelay: `${index * 0.04}s` }}
                      >
                        {/* Progress Bar */}
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
                                  onClick={() => removeLocalHistoryItem(canonicalKey)}
                                  className="text-white/30 hover:text-white hover:bg-white/10 rounded p-1 transition-colors -mr-1 -mt-1"
                                  title="Retirer de l'historique"
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

                            {/* Resume CTA */}
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
              )}
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Library;

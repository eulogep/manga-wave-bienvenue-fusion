import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BellRing,
  Bookmark,
  BookOpen,
  Check,
  Filter,
  Heart,
  LibraryBig,
  MoreVertical,
  Play,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCover from '@/components/MangaCover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useLibraryItems } from '@/hooks/useLibraryItems';
import { useFavorites } from '@/hooks/useManga';
import { useCanonicalFollow } from '@/hooks/useFollows';
import { useToast } from '@/hooks/use-toast';
import { buildReaderLocation } from '@/domain/readerNavigation';
import {
  filterLibraryItems,
  isInProgress,
  sortLibraryItems,
  searchLibraryItems,
  type LibraryItem,
  type LibrarySectionId,
  type LibrarySortOption,
} from '@/domain/libraryItem';

const SECTIONS: { id: LibrarySectionId; label: string; icon: typeof LibraryBig }[] = [
  { id: 'all', label: 'Tous', icon: LibraryBig },
  { id: 'in-progress', label: 'En cours', icon: Play },
  { id: 'favorites', label: 'Favoris', icon: Heart },
  { id: 'following', label: 'Suivis', icon: BellRing },
  { id: 'updates', label: 'Nouveautés', icon: Bookmark },
  { id: 'completed', label: 'Terminés', icon: Check },
];

const resumeAriaLabel = (item: LibraryItem) => (
  item.currentChapterNumber
    ? `Reprendre ${item.title} au chapitre ${item.currentChapterNumber}`
    : `Reprendre ${item.title}`
);

const LibraryCard = ({ item }: { item: LibraryItem }) => {
  const { toggleFavorite } = useFavorites();
  const { setFollowing, isUpdating: isFollowUpdating } = useCanonicalFollow(item.canonicalMangaId ?? undefined);
  const { toast } = useToast();
  const { user } = useAuth();

  const resumeUrl = item.resume
    ? buildReaderLocation({
      source: item.resume.source,
      mangaId: item.resume.providerMangaId,
      chapterId: item.resume.chapterId,
      language: item.resume.language,
      pageIndex: item.resume.pageIndex,
      mangaTitle: item.title,
      mangaAuthor: item.author,
    })
    : null;

  const updateUrl = item.unreadUpdate
    ? buildReaderLocation({
      source: item.unreadUpdate.provider,
      mangaId: item.unreadUpdate.providerMangaId,
      chapterId: item.unreadUpdate.providerChapterId,
      language: item.unreadUpdate.language,
      pageIndex: 0,
      mangaTitle: item.title,
      mangaAuthor: item.author,
    })
    : null;

  const detailUrl = item.canonicalMangaId !== null ? `/manga/${item.canonicalMangaId}` : null;

  const handleFavorite = async () => {
    if (item.canonicalMangaId === null) return;
    try {
      await toggleFavorite.mutateAsync(item.canonicalMangaId);
      toast({ title: item.favorite ? 'Retiré des favoris' : 'Ajouté aux favoris', description: item.title });
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de modifier les favoris.' });
    }
  };

  const handleFollow = async () => {
    if (item.canonicalMangaId === null || !user) return;
    try {
      await setFollowing(!item.following);
      toast({ title: item.following ? 'Suivi retiré' : 'Manga suivi', description: item.title });
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de modifier le suivi.' });
    }
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f1520]/80 shadow-card transition-all duration-300 hover:border-manga-purple/40 hover:shadow-card-hover animate-slide-up-fade">
      <div className="relative aspect-[3/4] overflow-hidden bg-black/40">
        <Link to={detailUrl || '#'} aria-label={`Voir la fiche de ${item.title}`}>
          <MangaCover
            src={item.cover}
            alt={`Couverture de ${item.title}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />

        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {item.following && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-manga-cyan">
              <BellRing className="h-2.5 w-2.5" /> Suivi
            </span>
          )}
          {item.favorite && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-manga-pink">
              <Heart className="h-2.5 w-2.5 fill-current" /> Favori
            </span>
          )}
          {item.unreadUpdate && item.unreadUpdate.count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mw-accent-coral)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
              Nouveau
            </span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Actions pour ${item.title}`}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white/85 opacity-0 transition-opacity hover:border-manga-purple group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#0f1520] border-white/15 text-white">
            <DropdownMenuItem onSelect={handleFavorite} disabled={item.canonicalMangaId === null}>
              <Heart className="h-3.5 w-3.5 mr-2" /> {item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleFollow} disabled={item.canonicalMangaId === null || isFollowUpdating}>
              <BellRing className="h-3.5 w-3.5 mr-2" /> {item.following ? 'Ne plus suivre' : 'Suivre'}
            </DropdownMenuItem>
            {detailUrl && (
              <DropdownMenuItem asChild>
                <Link to={detailUrl}><BookOpen className="h-3.5 w-3.5 mr-2" /> Voir la fiche</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {item.hasProgress && item.progressPercent !== null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <div className="h-full bg-gradient-to-r from-manga-purple to-manga-cyan" style={{ width: `${item.progressPercent}%` }} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <Link to={detailUrl || '#'} className="font-outfit text-sm font-bold text-white line-clamp-2 hover:text-manga-purple transition-colors">
            {item.title}
          </Link>
          {item.currentChapterNumber && (
            <p className="mt-1 text-xs font-medium text-manga-cyan">Chapitre {item.currentChapterNumber}</p>
          )}
        </div>

        <div className="mt-3">
          {updateUrl ? (
            <Button asChild size="sm" className="h-11 w-full bg-[var(--mw-accent-coral)] text-xs font-bold uppercase text-white hover:bg-[#ff6671]">
              <Link to={updateUrl} aria-label={`Lire le nouveau chapitre ${item.unreadUpdate?.chapterNumber} de ${item.title}`}>
                Nouveau chapitre {item.unreadUpdate?.chapterNumber}
              </Link>
            </Button>
          ) : resumeUrl ? (
            <Button asChild size="sm" className="btn-gradient h-11 w-full text-xs font-semibold">
              <Link to={resumeUrl} aria-label={resumeAriaLabel(item)}>
                <Play className="h-3.5 w-3.5 mr-1.5 fill-white" /> Reprendre
              </Link>
            </Button>
          ) : detailUrl ? (
            <Button asChild size="sm" variant="outline" className="h-11 w-full border-white/20 text-xs font-semibold">
              <Link to={detailUrl}>Commencer</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
};

const Library = () => {
  const { user, loading } = useAuth();
  const { data: items = [], isLoading, isError, error, refetch, isFetching } = useLibraryItems();

  const [section, setSection] = useState<LibrarySectionId>('all');
  const [sort, setSort] = useState<LibrarySortOption>('activity');
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Switching sections should not preserve a stale search across very different sets.
  }, [section]);

  const sectioned = useMemo(() => filterLibraryItems(items, section), [items, section]);
  const searched = useMemo(() => searchLibraryItems(sectioned, query), [sectioned, query]);
  const visible = useMemo(() => sortLibraryItems(searched, sort), [searched, sort]);

  const counts = useMemo(() => ({
    all: items.length,
    'in-progress': items.filter(isInProgress).length,
    favorites: items.filter((item) => item.favorite).length,
    following: items.filter((item) => item.following).length,
    updates: items.filter((item) => item.unreadUpdate && item.unreadUpdate.count > 0).length,
    completed: items.filter((item) => item.canonicalStatus === 'completed').length,
  }), [items]);

  if (loading || (user && isLoading)) {
    return (
      <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
        <Header />
        <main className="flex-1 section-padding py-12" aria-busy="true" aria-live="polite">
          <div className="container mx-auto animate-pulse space-y-8">
            <div className="h-10 rounded-xl bg-white/10 max-w-sm" />
            <div className="h-14 rounded-2xl bg-white/5" />
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
          <section className="mb-8">
            <Link to="/history" className="inline-flex min-h-11 items-center text-cyan-300">Historique de lecture</Link>
            <p className="text-manga-cyan font-semibold tracking-widest text-xs mb-2">ESPACE PERSONNEL</p>
            <h1 className="text-4xl md:text-5xl font-bold font-japanese mb-2">
              Ma <span className="glow-text">Bibliothèque</span>
            </h1>
            <p className="text-white/50 text-sm md:text-base">
              Un seul endroit pour retrouver, suivre et reprendre vos mangas — quelle que soit la source.
            </p>
          </section>

          {!user ? (
            <section className="rounded-3xl border border-manga-purple/30 bg-gradient-to-br from-manga-purple/15 to-manga-cyan/5 p-8 md:p-12 text-center max-w-2xl mx-auto my-8">
              <LibraryBig className="h-12 w-12 text-manga-pink mx-auto mb-4" />
              <h2 className="text-2xl font-bold font-outfit mb-2">Synchronisez votre bibliothèque</h2>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                Connectez-vous pour retrouver vos favoris, vos suivis et votre progression sur tous vos appareils.
              </p>
              <Button className="btn-gradient rounded-full px-8" asChild>
                <Link to="/auth">Se connecter</Link>
              </Button>
            </section>
          ) : isError ? (
            <section className="container mx-auto max-w-xl text-center rounded-2xl border border-destructive/40 bg-destructive/10 p-8">
              <h2 className="text-xl font-bold mb-2">Bibliothèque indisponible</h2>
              <p className="text-white/60 mb-6 text-sm">{error?.message}</p>
              <Button className="btn-gradient" onClick={() => refetch()} disabled={isFetching}>Réessayer</Button>
            </section>
          ) : (
            <>
              <div role="tablist" aria-label="Sections de la bibliothèque" className="mb-6 flex flex-wrap gap-2 overflow-x-auto pb-1">
                {SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={section === id}
                    onClick={() => setSection(id)}
                    className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                      section === id
                        ? 'bg-manga-purple text-white shadow-glow-purple'
                        : 'bg-white/[0.05] text-white/60 border border-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {label} ({counts[id]})
                  </button>
                ))}
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Rechercher dans votre bibliothèque"
                      aria-label="Rechercher dans votre bibliothèque"
                      className="h-11 bg-[#0f1520] border-white/15 pl-9 text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/50 shrink-0">
                    <SlidersHorizontal className="h-4 w-4 text-manga-cyan" /> Tri
                  </div>
                  <Select value={sort} onValueChange={(value) => setSort(value as LibrarySortOption)}>
                    <SelectTrigger aria-label="Trier la bibliothèque" className="h-11 bg-[#0f1520] border-white/15 text-white lg:w-64">
                      <Filter className="h-3.5 w-3.5 mr-2 text-white/40" />
                      <SelectValue placeholder="Trier" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f1520] border-white/20 text-white">
                      <SelectItem value="activity">Activité récente</SelectItem>
                      <SelectItem value="lastRead">Dernière lecture</SelectItem>
                      <SelectItem value="lastUpdated">Dernière mise à jour</SelectItem>
                      <SelectItem value="title">Titre A–Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>

              {items.length === 0 ? (
                <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-16 px-6 text-center">
                  <LibraryBig className="h-12 w-12 text-manga-purple mx-auto mb-4 opacity-70" />
                  <h2 className="text-xl font-bold mb-2">Ta bibliothèque est vide.</h2>
                  <p className="text-white/50 max-w-md mx-auto text-sm mb-6">
                    Ajoute des favoris, suis des mangas ou commence une lecture pour les retrouver ici.
                  </p>
                  <Button className="btn-gradient rounded-full px-6" asChild>
                    <Link to="/search">Découvrir des mangas</Link>
                  </Button>
                </section>
              ) : visible.length === 0 ? (
                <section className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] py-14 px-6 text-center">
                  <Filter className="h-10 w-10 text-manga-cyan mx-auto mb-3" />
                  <h2 className="text-lg font-bold mb-2">Aucun titre ne correspond à ce filtre</h2>
                  <Button variant="outline" className="border-white/20 mt-3" onClick={() => { setQuery(''); setSection('all'); }}>
                    Réinitialiser les filtres
                  </Button>
                </section>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6 text-xs text-white/50">
                    <span>{visible.length} titre{visible.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {visible.map((item) => <LibraryCard key={item.canonicalKey} item={item} />)}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Library;

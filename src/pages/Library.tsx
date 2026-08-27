import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, ChevronLeft, ChevronRight, Filter, Heart, LibraryBig, SlidersHorizontal } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCard from '@/components/MangaCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useLibrary } from '@/hooks/useLibrary';
import type { MangaDexStatus } from '@/integrations/mangadex/client';

const PAGE_SIZE = 12;

type SortOption = 'recent' | 'title' | 'rating' | 'updated';

const Library = () => {
  const { user, loading } = useAuth();
  const { data: library = [], isLoading, isError, error, refetch, isFetching } = useLibrary();
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

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 section-padding py-12" aria-busy="true" aria-live="polite">
          <div className="container mx-auto animate-pulse space-y-8">
            <div className="h-10 rounded bg-white/10 max-w-sm" />
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

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 section-padding py-16">
          <section className="container mx-auto max-w-2xl text-center rounded-3xl border border-manga-purple/30 bg-gradient-to-br from-manga-purple/15 to-manga-cyan/5 p-8 md:p-12">
            <Heart className="h-12 w-12 text-manga-pink mx-auto mb-5" />
            <p className="text-manga-cyan font-medium tracking-widest text-sm mb-3">ESPACE PERSONNEL</p>
            <h1 className="text-3xl md:text-4xl font-bold font-japanese mb-4">Votre bibliothèque vous attend</h1>
            <p className="text-muted-foreground leading-7 max-w-lg mx-auto mb-7">Connectez-vous pour enregistrer vos favoris, les retrouver sur tous vos appareils et reprendre vos derniers chapitres.</p>
            <Button className="btn-gradient" size="lg" asChild>
              <Link to="/auth">Se connecter</Link>
            </Button>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 section-padding py-16">
          <section className="container mx-auto max-w-xl text-center rounded-2xl border border-destructive/40 bg-destructive/10 p-8">
            <h1 className="text-2xl font-bold mb-3">Bibliothèque indisponible</h1>
            <p className="text-muted-foreground mb-6">{error.message}</p>
            <Button className="btn-gradient" onClick={() => refetch()} disabled={isFetching}>Réessayer</Button>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14">
        <div className="container mx-auto">
          <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <p className="text-manga-cyan font-medium tracking-widest text-sm mb-3">ESPACE PERSONNEL</p>
              <h1 className="text-4xl md:text-5xl font-bold font-japanese mb-3">Ma <span className="glow-text">bibliothèque</span></h1>
              <p className="text-muted-foreground text-lg">Vos mangas enregistrés, prêts à être retrouvés en un instant.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 min-w-48">
              <div className="flex items-center gap-3">
                <BookMarked className="h-5 w-5 text-manga-purple" />
                <div><p className="font-semibold">{library.length} favori{library.length > 1 ? 's' : ''}</p><p className="text-xs text-muted-foreground">synchronisés avec votre compte</p></div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 mb-8">
            <div className="flex flex-col xl:flex-row xl:items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0"><SlidersHorizontal className="h-4 w-4 text-manga-cyan" /> Personnaliser l’affichage</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger className="bg-manga-dark/50 border-white/20"><Filter className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Genre" /></SelectTrigger>
                  <SelectContent className="bg-manga-dark border-white/20 max-h-64"><SelectItem value="all">Tous les genres</SelectItem>{genres.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={status} onValueChange={(value) => setStatus(value as 'all' | MangaDexStatus)}>
                  <SelectTrigger className="bg-manga-dark/50 border-white/20"><SelectValue placeholder="Statut" /></SelectTrigger>
                  <SelectContent className="bg-manga-dark border-white/20"><SelectItem value="all">Tous statuts</SelectItem><SelectItem value="ongoing">En cours</SelectItem><SelectItem value="completed">Terminé</SelectItem><SelectItem value="hiatus">En pause</SelectItem><SelectItem value="cancelled">Annulé</SelectItem></SelectContent>
                </Select>
                <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
                  <SelectTrigger className="bg-manga-dark/50 border-white/20"><SelectValue placeholder="Trier" /></SelectTrigger>
                  <SelectContent className="bg-manga-dark border-white/20"><SelectItem value="recent">Ajoutés récemment</SelectItem><SelectItem value="title">Titre A → Z</SelectItem><SelectItem value="rating">Meilleures notes</SelectItem><SelectItem value="updated">Dernière mise à jour</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {library.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-white/20 bg-white/5 py-16 px-6 text-center">
              <LibraryBig className="h-12 w-12 text-manga-purple mx-auto mb-5" />
              <h2 className="text-2xl font-bold mb-3">Votre bibliothèque est encore vide</h2>
              <p className="text-muted-foreground max-w-md mx-auto leading-7 mb-7">Ajoutez des titres à vos favoris depuis la sélection locale pour les garder à portée de main.</p>
              <Button className="btn-gradient" asChild><Link to="/#mangas">Explorer le catalogue</Link></Button>
            </section>
          ) : filteredLibrary.length === 0 ? (
            <section className="rounded-3xl border border-dashed border-white/20 bg-white/5 py-14 px-6 text-center">
              <Filter className="h-10 w-10 text-manga-cyan mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Aucun favori ne correspond aux filtres</h2>
              <Button variant="outline" className="border-white/30 mt-4" onClick={() => { setGenre('all'); setStatus('all'); setSort('recent'); }}>Réinitialiser les filtres</Button>
            </section>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6"><p className="text-sm text-muted-foreground">{filteredLibrary.length} titre{filteredLibrary.length > 1 ? 's' : ''} affiché{filteredLibrary.length > 1 ? 's' : ''}</p><p className="text-sm text-muted-foreground">Page {currentPage + 1} sur {totalPages}</p></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {visibleMangas.map((manga, index) => (
                  <div key={manga.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                    <MangaCard id={manga.id} favoriteId={manga.id} isFavorite title={manga.title} author={manga.author || 'Auteur inconnu'} rating={manga.rating} status={manga.status as MangaDexStatus} genre={manga.genre} imageUrl={manga.cover_image} lastUpdate={new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(new Date(manga.source_updated_at || manga.created_at))} detailUrl={manga.mangadex_id ? `/manga/${manga.mangadex_id}` : undefined} externalUrl={manga.mangadex_id ? `https://mangadex.org/title/${manga.mangadex_id}` : undefined} />
                  </div>
                ))}
              </div>
              {totalPages > 1 && <div className="flex justify-center items-center gap-4 mt-10"><Button variant="outline" size="icon" className="border-white/30" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Page précédente"><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm text-muted-foreground">{currentPage + 1} / {totalPages}</span><Button variant="outline" size="icon" className="border-white/30" disabled={currentPage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} aria-label="Page suivante"><ChevronRight className="h-4 w-4" /></Button></div>}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Library;

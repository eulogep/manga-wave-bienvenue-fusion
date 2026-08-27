import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MangaCard from './MangaCard';
import { useManga } from '@/hooks/useManga';
import type { MangaDexStatus } from '@/integrations/mangadex/client';

const PAGE_SIZE = 6;

const FeaturedSection = () => {
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | MangaDexStatus>('all');
  const [page, setPage] = useState(0);
  const { mangas, favorites, isLoading, isError, error, refetch, isFetching } = useManga();

  const genres = useMemo(
    () =>
      [...new Set(mangas.flatMap((manga) => manga.genre))]
        .sort((left, right) => left.localeCompare(right, 'fr'))
        .slice(0, 12),
    [mangas],
  );

  const filteredMangas = useMemo(
    () =>
      mangas.filter((manga) => {
        const matchesGenre = selectedGenre === 'all' || manga.genre.includes(selectedGenre);
        const matchesStatus = selectedStatus === 'all' || manga.status === selectedStatus;
        return matchesGenre && matchesStatus;
      }),
    [mangas, selectedGenre, selectedStatus],
  );

  const totalPages = Math.max(1, Math.ceil(filteredMangas.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleMangas = filteredMangas.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  if (isLoading) {
    return (
      <section className="py-16 section-padding" aria-busy="true" aria-live="polite">
        <div className="container mx-auto">
          <div className="text-center animate-pulse">
            <div className="h-8 bg-white/10 rounded w-64 mx-auto mb-4" />
            <div className="h-4 bg-white/10 rounded w-96 max-w-full mx-auto" />
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="py-16 section-padding">
        <div className="container mx-auto max-w-2xl text-center rounded-xl border border-destructive/40 bg-destructive/10 p-8">
          <h2 className="text-2xl font-bold mb-3">Catalogue indisponible</h2>
          <p className="text-muted-foreground mb-6">
            {error.message} Vérifiez la connexion au catalogue local puis relancez la requête.
          </p>
          <Button className="btn-gradient" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Réessayer
          </Button>
        </div>
      </section>
    );
  }

  const goToPreviousPage = () => {
    setPage((activePage) => Math.max(0, activePage - 1));
  };

  const goToNextPage = () => {
    setPage((activePage) => Math.min(totalPages - 1, activePage + 1));
  };

  return (
    <section id="mangas" className="py-16 section-padding">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12 gap-6">
          <div>
            <h2 className="text-4xl font-bold mb-4 font-japanese">
              <span className="glow-text">Sélection</span> locale MangaDex
            </h2>
            <p className="text-xl text-muted-foreground">
              Les titres synchronisés depuis MangaDex et disponibles en français
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtrer :</span>
            </div>

            <Select
              value={selectedGenre}
              onValueChange={(genre) => {
                setSelectedGenre(genre);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40 bg-white/10 border-white/20">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent className="bg-manga-dark border-white/20 max-h-64">
                <SelectItem value="all">Tous les genres</SelectItem>
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedStatus}
              onValueChange={(value) => {
                setSelectedStatus(value as 'all' | MangaDexStatus);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-36 bg-white/10 border-white/20">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-manga-dark border-white/20">
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="ongoing">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="hiatus">Pause</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8">
          <p className="text-sm text-muted-foreground">
            {filteredMangas.length} titre{filteredMangas.length > 1 ? 's' : ''} dans cette sélection
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Afficher les titres précédents"
              className="border-white/30 hover:bg-white/10"
              disabled={currentPage === 0}
              onClick={goToPreviousPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-12 text-center">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Afficher les titres suivants"
              className="border-white/30 hover:bg-white/10"
              disabled={currentPage >= totalPages - 1}
              onClick={goToNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {visibleMangas.length > 0 ? (
            visibleMangas.map((manga, index) => (
              <div key={manga.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.08}s` }}>
                <MangaCard
                  id={manga.id}
                  title={manga.title}
                  author={manga.author || 'Auteur inconnu'}
                  status={manga.status}
                  genre={manga.genre}
                  imageUrl={manga.cover_image}
                  lastUpdate={new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(
                    new Date(manga.source_updated_at || manga.created_at),
                  )}
                  isFavorite={favorites.includes(manga.id)}
                  favoriteId={manga.id}
                  externalUrl={manga.mangadex_id ? `https://mangadex.org/title/${manga.mangadex_id}` : undefined}
                  detailUrl={manga.mangadex_id ? `/manga/${manga.mangadex_id}` : undefined}
                />
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 rounded-xl border border-white/10 bg-white/5">
              <p className="text-muted-foreground text-lg">Aucun manga ne correspond aux filtres choisis.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="text-center mt-12">
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 hover:bg-white/10"
              disabled={currentPage >= totalPages - 1}
              onClick={goToNextPage}
            >
              Voir plus de mangas
            </Button>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Données et couvertures fournies par MangaDex. Les contenus restent la propriété de leurs ayants droit.
        </p>
      </div>
    </section>
  );
};

export default FeaturedSection;

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MangaCard from './MangaCard';
import { useManga } from '@/hooks/useManga';
import type { MangaDexStatus } from '@/integrations/mangadex/client';

const PAGE_SIZE = 6;

const GENRE_PILLS = ['Action', 'Romance', 'Fantasy', 'Supernatural', 'Slice of Life', 'Comedy', 'Horror', 'Sci-Fi'];

const FeaturedSection = () => {
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | MangaDexStatus>('all');
  const [page, setPage] = useState(0);
  const { mangas, favorites, isLoading, isError, error, refetch, isFetching } = useManga();

  const genres = useMemo(
    () =>
      [...new Set(mangas.flatMap((manga) => manga.genre))]
        .sort((a, b) => a.localeCompare(b, 'fr'))
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
  const visibleMangas = filteredMangas.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  if (isLoading) {
    return (
      <section className="py-20 section-padding" aria-busy="true" aria-live="polite">
        <div className="container mx-auto">
          <div className="mb-10">
            <div className="skeleton h-8 w-56 mb-3 rounded-lg" />
            <div className="skeleton h-4 w-80 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] cover-skeleton rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="py-20 section-padding">
        <div className="container mx-auto max-w-xl text-center glass-card p-10">
          <h2 className="font-outfit font-bold text-2xl mb-3">Catalogue indisponible</h2>
          <p className="text-white/50 mb-6 text-sm">{error?.message}</p>
          <Button className="btn-gradient rounded-full px-6" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Réessayer
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section id="mangas" className="py-20 section-padding">
      <div className="container mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-semibold text-manga-purple/80 uppercase tracking-widest mb-2">Catalogue MangaDex</p>
            <h2 className="font-outfit font-bold text-3xl md:text-4xl text-white">
              Sélection <span className="glow-text-purple">Locale</span>
            </h2>
            <p className="text-white/40 mt-2 text-sm">
              {filteredMangas.length} titre{filteredMangas.length > 1 ? 's' : ''} · synchronisés en français
            </p>
          </div>

          {/* Status select */}
          <Select
            value={selectedStatus}
            onValueChange={(v) => { setSelectedStatus(v as 'all' | MangaDexStatus); setPage(0); }}
          >
            <SelectTrigger className="w-36 bg-white/[0.05] border-white/[0.08] text-white/80 rounded-xl">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent className="bg-[#0f1520] border-white/[0.08] rounded-xl">
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="ongoing">En cours</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
              <SelectItem value="hiatus">Pause</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Pill Genre Filter ── */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2 mb-8">
          <button
            onClick={() => { setSelectedGenre('all'); setPage(0); }}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
              selectedGenre === 'all'
                ? 'bg-manga-purple text-white border-manga-purple shadow-glow-purple'
                : 'bg-transparent text-white/50 border-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            Tous
          </button>
          {(genres.length > 0 ? genres : GENRE_PILLS).map((genre) => (
            <button
              key={genre}
              onClick={() => { setSelectedGenre(genre); setPage(0); }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                selectedGenre === genre
                  ? 'bg-manga-purple text-white border-manga-purple shadow-glow-purple'
                  : 'bg-transparent text-white/50 border-white/[0.08] hover:text-white hover:border-white/20'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* ── Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {visibleMangas.length > 0 ? (
            visibleMangas.map((manga, index) => (
              <div
                key={manga.id}
                className="animate-slide-up-fade"
                style={{ animationDelay: `${index * 0.06}s`, opacity: 0 }}
              >
                <MangaCard
                  id={manga.id}
                  title={manga.title}
                  author={manga.author || 'Auteur inconnu'}
                  rating={manga.rating ?? null}
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
            <div className="col-span-full text-center py-16 glass-card rounded-2xl">
              <p className="text-white/40">Aucun manga ne correspond aux filtres choisis.</p>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Page précédente"
              className="h-9 w-9 rounded-full border border-white/[0.08] hover:bg-white/[0.06] disabled:opacity-30"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-white/40 min-w-16 text-center">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Page suivante"
              className="h-9 w-9 rounded-full border border-white/[0.08] hover:bg-white/[0.06] disabled:opacity-30"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <p className="mt-10 text-center text-[11px] text-white/25">
          Données et couvertures fournies par MangaDex. Contenus propriété de leurs ayants droit.
        </p>
      </div>
    </section>
  );
};

export default FeaturedSection;

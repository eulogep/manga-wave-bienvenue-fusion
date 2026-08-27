import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCard from '@/components/MangaCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMangaDexSearch } from '@/hooks/useMangaDex';
import { useCatalogSearch } from '@/hooks/useCatalogSearch';
import type { MangaDexStatus } from '@/integrations/mangadex/client';
import type { UnifiedCatalogItem } from '@/integrations/catalog/providers';

const PAGE_SIZE = 24;

type SearchStatus = 'all' | MangaDexStatus;

const statusOptions: Array<{ value: SearchStatus; label: string }> = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'ongoing', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'hiatus', label: 'En pause' },
  { value: 'cancelled', label: 'Annulé' },
];

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialStatus = (searchParams.get('status') || 'all') as SearchStatus;
  const initialPage = Math.max(Number(searchParams.get('page') || '1'), 1);
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<SearchStatus>(initialStatus);

  const { data, isLoading, isFetching, isError, error, refetch } = useMangaDexSearch({
    title: initialQuery,
    status: initialStatus === 'all' ? undefined : initialStatus,
    offset: (initialPage - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });
  const providersQuery = useCatalogSearch({
    query: initialQuery,
    provider: 'all',
    mediaType: 'manga',
    limit: 8,
  });

  const providerStatus = (item: UnifiedCatalogItem): MangaDexStatus => {
    const status = item.status?.toLowerCase();
    if (status?.includes('complete') || status === 'finished' || status === 'finished_airing') return 'completed';
    if (status?.includes('hiatus')) return 'hiatus';
    if (status?.includes('cancel')) return 'cancelled';
    return 'ongoing';
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) return;

    const nextParams = new URLSearchParams({ q: trimmedQuery, page: '1' });
    if (status !== 'all') nextParams.set('status', status);
    setSearchParams(nextParams);
  };

  const goToPage = (nextPage: number) => {
    const nextParams = new URLSearchParams({ q: initialQuery, page: String(nextPage) });
    if (initialStatus !== 'all') nextParams.set('status', initialStatus);
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));
  const hasSearch = initialQuery.trim().length >= 2;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 section-padding py-12">
        <div className="container mx-auto">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l’accueil
          </Link>

          <div className="max-w-4xl mb-10">
            <p className="text-manga-cyan font-medium mb-3">CATALOGUE MANGADEX</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 font-japanese">
              Recherche <span className="glow-text">avancée</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Recherchez un titre précis et affinez les résultats par statut de publication.
            </p>
          </div>

          <form onSubmit={submitSearch} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-4 rounded-2xl border border-white/10 bg-card/50 p-5 mb-10">
            <div className="space-y-2">
              <Label htmlFor="manga-search">Titre du manga</Label>
              <Input
                id="manga-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                minLength={2}
                required
                placeholder="Ex. Berserk, One Piece, Frieren…"
                className="bg-white/10 border-white/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manga-status">Statut</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as SearchStatus)}>
                <SelectTrigger id="manga-status" className="bg-white/10 border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-manga-dark border-white/20">
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="btn-gradient md:self-end" disabled={query.trim().length < 2}>
              <SearchIcon className="h-4 w-4 mr-2" />
              Rechercher
            </Button>
          </form>

          {!hasSearch && (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 py-20 px-6 text-center">
              <SearchIcon className="h-12 w-12 text-manga-purple mx-auto mb-5" />
              <h2 className="text-2xl font-bold mb-3">Trouvez votre prochaine lecture</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Saisissez au moins deux caractères pour rechercher dans le catalogue MangaDex.
              </p>
            </div>
          )}

          {hasSearch && isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6" aria-busy="true">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="aspect-[3/5] rounded-xl bg-white/10 animate-pulse" />
              ))}
            </div>
          )}

          {hasSearch && isError && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
              <h2 className="text-2xl font-bold mb-3">La recherche est indisponible</h2>
              <p className="text-muted-foreground mb-6">{error.message}</p>
              <Button className="btn-gradient" onClick={() => refetch()} disabled={isFetching}>
                Réessayer
              </Button>
            </div>
          )}

          {hasSearch && !isLoading && !isError && data && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
                <p className="text-muted-foreground">
                  <span className="text-white font-semibold">{data.total.toLocaleString('fr-FR')}</span> résultat{data.total > 1 ? 's' : ''} pour « {initialQuery} »
                </p>
                <p className="text-sm text-muted-foreground">Page {initialPage} sur {totalPages}</p>
              </div>

              {data.mangas.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                  {data.mangas.map((manga) => (
                    <MangaCard
                      key={manga.id}
                      id={manga.id}
                      title={manga.title}
                      author={manga.author}
                      status={manga.status}
                      genre={manga.genres}
                      imageUrl={manga.coverImageUrl}
                      lastUpdate={new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(new Date(manga.updatedAt))}
                      externalUrl={manga.externalUrl}
                      detailUrl={`/manga/${manga.id}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 py-16 px-6 text-center">
                  <h2 className="text-2xl font-bold mb-3">Aucun résultat</h2>
                  <p className="text-muted-foreground">Essayez un autre titre ou modifiez le statut sélectionné.</p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-12">
                  <Button variant="outline" className="border-white/30" disabled={initialPage === 1} onClick={() => goToPage(initialPage - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Précédent
                  </Button>
                  <span className="text-sm text-muted-foreground">{initialPage} / {totalPages}</span>
                  <Button variant="outline" className="border-white/30" disabled={initialPage >= totalPages} onClick={() => goToPage(initialPage + 1)}>
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}

          {hasSearch && providersQuery.data && providersQuery.data.length > 0 && (
            <section className="mt-16 pt-10 border-t border-white/10" aria-labelledby="other-providers-title">
              <div className="mb-7">
                <p className="text-manga-cyan font-medium mb-2">AUTRES CATALOGUES</p>
                <h2 id="other-providers-title" className="text-3xl font-bold font-japanese">Résultats <span className="glow-text">multi-sources</span></h2>
                <p className="text-muted-foreground mt-2">Métadonnées publiques réunies depuis AniList, Jikan et Kitsu. La lecture reste proposée uniquement via les liens officiels.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {providersQuery.data.map((item) => (
                  <div key={`${item.provider}-${item.sourceId}`} className="relative">
                    <span className="absolute z-10 top-2 left-2 rounded-full bg-manga-dark/90 border border-white/20 px-2 py-1 text-[10px] uppercase tracking-wide text-white/80">{item.provider}</span>
                    <MangaCard
                      id={`${item.provider}-${item.sourceId}`}
                      title={item.title}
                      author={item.provider === 'jikan' ? 'MyAnimeList via Jikan' : item.provider === 'anilist' ? 'AniList' : 'Kitsu'}
                      status={providerStatus(item)}
                      genre={item.genres}
                      imageUrl={item.coverImageUrl}
                      lastUpdate={item.year ? String(item.year) : 'Métadonnées'}
                      externalUrl={item.officialUrl || undefined}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Search;

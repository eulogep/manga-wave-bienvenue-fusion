import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Globe,
  Quote,
  Search as SearchIcon,
  Sparkles,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCard from '@/components/MangaCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMangaDexSearch } from '@/hooks/useMangaDex';
import { useOriginMangaSearch } from '@/hooks/useOriginManga';
import { useCatalogSearch } from '@/hooks/useCatalogSearch';
import {
  useComickSearch,
  useCrunchyScanSearch,
  useMangaFireSearch,
  useAsuraSearch,
} from '@/hooks/useExternalSources';
import { useAnimeQuote } from '@/hooks/useAnimeQuote';
import type { MangaDexStatus } from '@/integrations/mangadex/client';
import type { UnifiedCatalogItem } from '@/integrations/catalog/providers';
import type { SourceType } from '@/integrations/sources';

const PAGE_SIZE = 24;

type SearchStatus = 'all' | MangaDexStatus;
type SelectedSource = 'all' | 'mangadex' | 'originmanga' | 'comick' | 'crunchyscan' | 'mangafire' | 'asurascans';

const statusOptions: Array<{ value: SearchStatus; label: string }> = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'ongoing', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'hiatus', label: 'En pause' },
  { value: 'cancelled', label: 'Annulé' },
];

const sourceOptions: Array<{ value: SelectedSource; label: string; badge: string; isNew?: boolean }> = [
  { value: 'all', label: 'Toutes les sources (Multi-Sources)', badge: 'Multi' },
  { value: 'comick', label: 'Comick.io (Scans FR/EN + Reader)', badge: 'VF/EN', isNew: true },
  { value: 'crunchyscan', label: 'LelManga (Scans VF)', badge: 'VF', isNew: true },
  { value: 'originmanga', label: 'OriginManga (Scans FR)', badge: 'VF' },
  { value: 'mangadex', label: 'MangaDex (Catalogue officiel)', badge: 'Multi' },
  { value: 'asurascans', label: 'AsuraScans (Manhwas Action)', badge: 'EN', isNew: true },
  { value: 'mangafire', label: 'MangaFire (Manga/Manhwa)', badge: 'Multi', isNew: true },
];

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialStatus = (searchParams.get('status') || 'all') as SearchStatus;
  const initialSource = (searchParams.get('source') || 'all') as SelectedSource;
  const initialPage = Math.max(Number(searchParams.get('page') || '1'), 1);

  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<SearchStatus>(initialStatus);
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(initialSource);

  const quoteQuery = useAnimeQuote();

  // Queries for various sources
  const shouldSearchMangaDex = selectedSource === 'all' || selectedSource === 'mangadex';
  const mangaDexQuery = useMangaDexSearch({
    title: initialQuery,
    status: initialStatus === 'all' ? undefined : initialStatus,
    offset: (initialPage - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const shouldSearchOrigin = selectedSource === 'all' || selectedSource === 'originmanga';
  const originQuery = useOriginMangaSearch(initialQuery, initialPage);

  const shouldSearchComick = selectedSource === 'all' || selectedSource === 'comick';
  const comickQuery = useComickSearch(initialQuery, initialPage);

  const shouldSearchCrunchy = selectedSource === 'all' || selectedSource === 'crunchyscan';
  const crunchyQuery = useCrunchyScanSearch(initialQuery);

  const shouldSearchMangaFire = selectedSource === 'all' || selectedSource === 'mangafire';
  const mangaFireQuery = useMangaFireSearch(initialQuery);

  const shouldSearchAsura = selectedSource === 'all' || selectedSource === 'asurascans';
  const asuraQuery = useAsuraSearch(initialQuery);

  // External catalog query (AniList, Jikan, Kitsu, Shikimori)
  const providersQuery = useCatalogSearch({
    query: initialQuery,
    provider: 'all',
    mediaType: 'manga',
    limit: 8,
  });

  const providerStatus = (item: UnifiedCatalogItem): MangaDexStatus => {
    const s = item.status?.toLowerCase();
    if (s?.includes('complete') || s === 'finished' || s === 'finished_airing') return 'completed';
    if (s?.includes('hiatus')) return 'hiatus';
    if (s?.includes('cancel')) return 'cancelled';
    return 'ongoing';
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;

    const nextParams = new URLSearchParams({ q: trimmedQuery, page: '1' });
    if (status !== 'all') nextParams.set('status', status);
    if (selectedSource !== 'all') nextParams.set('source', selectedSource);
    setSearchParams(nextParams);
  };

  const selectQuickSource = (src: SelectedSource) => {
    setSelectedSource(src);
    const nextParams = new URLSearchParams(searchParams);
    if (src === 'all') nextParams.delete('source');
    else nextParams.set('source', src);
    setSearchParams(nextParams);
  };

  const goToPage = (nextPage: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('page', String(nextPage));
    setSearchParams(nextParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasSearch = initialQuery.trim().length >= 2;
  const totalMangaDexPages = Math.max(1, Math.ceil((mangaDexQuery.data?.total || 0) / PAGE_SIZE));

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex-1 section-padding py-12">
        <div className="container mx-auto">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-white/50 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l’accueil
          </Link>

          {/* Top Title & Anime Quote */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge className="bg-manga-purple/20 text-manga-purple-light border-manga-purple/30">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  MOTEUR MULTI-SOURCES TACHIYOMI
                </Badge>
                <Badge variant="outline" className="border-white/10 text-white/60">
                  6 Sources Actives
                </Badge>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold font-japanese tracking-tight">
                Recherche <span className="glow-text">Multi-Sources</span>
              </h1>
              <p className="text-sm md:text-base text-white/60 mt-2">
                Recherchez simultanément sur Comick.io, OriginManga, LelManga, MangaDex, AsuraScans et MangaFire.
              </p>
            </div>

            {/* Anime Quote banner from public-apis */}
            {quoteQuery.data && (
              <div className="glass-card p-4 max-w-md rounded-xl border border-white/10 relative overflow-hidden">
                <Quote className="h-6 w-6 text-manga-purple/30 absolute top-2 right-2" />
                <p className="text-xs italic text-white/80 line-clamp-2">
                  « {quoteQuery.data.quote} »
                </p>
                <p className="text-[10px] text-manga-cyan mt-1.5 font-semibold">
                  — {quoteQuery.data.character} <span className="text-white/40">({quoteQuery.data.anime})</span>
                </p>
              </div>
            )}
          </div>

          {/* Quick source pills */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-3 mb-6">
            {sourceOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => selectQuickSource(opt.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 border ${
                  selectedSource === opt.value
                    ? 'bg-manga-purple text-white border-manga-purple shadow-glow-purple'
                    : 'bg-white/[0.04] text-white/60 border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <span>{opt.label.split('(')[0].trim()}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-white/80">
                  {opt.badge}
                </span>
                {opt.isNew && (
                  <span className="w-1.5 h-1.5 rounded-full bg-manga-success animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form
            onSubmit={submitSearch}
            className="grid grid-cols-1 md:grid-cols-[1fr_220px_180px_auto] gap-4 rounded-2xl border border-white/10 bg-[#0f1520] p-5 mb-10 shadow-lg"
          >
            <div className="space-y-2">
              <Label htmlFor="manga-search" className="text-xs font-medium text-white/60">Titre du manga / manhwa</Label>
              <Input
                id="manga-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                minLength={2}
                required
                placeholder="Ex. Solo Leveling, One Piece, Jujutsu Kaisen, Berserk…"
                className="bg-white/5 border-white/15 text-white placeholder:text-white/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-select" className="text-xs font-medium text-white/60">Source cible</Label>
              <Select value={selectedSource} onValueChange={(value) => setSelectedSource(value as SelectedSource)}>
                <SelectTrigger id="source-select" className="bg-white/5 border-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1520] border-white/20 text-white">
                  {sourceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manga-status" className="text-xs font-medium text-white/60">Statut</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as SearchStatus)}>
                <SelectTrigger id="manga-status" className="bg-white/5 border-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1520] border-white/20 text-white">
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="btn-gradient md:self-end h-10 px-6 rounded-xl" disabled={query.trim().length < 2}>
              <SearchIcon className="h-4 w-4 mr-2" />
              Rechercher
            </Button>
          </form>

          {!hasSearch && (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-20 px-6 text-center">
              <SearchIcon className="h-12 w-12 text-manga-purple mx-auto mb-5 opacity-80" />
              <h2 className="text-2xl font-bold mb-2">Trouvez votre prochaine lecture</h2>
              <p className="text-white/50 max-w-xl mx-auto text-sm">
                Saisissez au moins deux caractères pour explorer tous les catalogues simultanément.
              </p>
            </div>
          )}

          {/* 1. COMICK.IO RESULTS SECTION */}
          {hasSearch && shouldSearchComick && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-gradient-to-r from-manga-purple to-manga-pink text-white border-0">
                      Comick.io
                    </Badge>
                    <span className="text-xs text-manga-cyan font-medium">API Directe · Scans FR & EN · Lecteur In-App</span>
                  </div>
                  <h2 className="text-2xl font-bold font-japanese">Résultats Comick.io</h2>
                </div>
              </div>

              {comickQuery.isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="aspect-[3/4] rounded-xl cover-skeleton" />
                  ))}
                </div>
              )}

              {comickQuery.isError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
                  <p className="text-xs text-white/60">
                    Comick.io indisponible temporairement : {(comickQuery.error as Error)?.message}
                  </p>
                </div>
              )}

              {!comickQuery.isLoading && !comickQuery.isError && comickQuery.data && (
                <div>
                  {comickQuery.data.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {comickQuery.data.map((item) => (
                        <div key={`comick-${item.id}`} className="relative group">
                          <span className="absolute z-10 top-2 left-2 rounded-full bg-gradient-to-r from-manga-purple to-manga-cyan px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow">
                            Comick
                          </span>
                          <MangaCard
                            id={item.id}
                            title={item.title}
                            author="Comick"
                            rating={item.rating}
                            status="ongoing"
                            genre={item.genres}
                            imageUrl={item.coverUrl}
                            lastUpdate={item.lastChapter ? `Ch. ${item.lastChapter}` : 'Chapitres'}
                            externalUrl={item.url}
                            detailUrl={`/manga/${item.slug}?source=comick`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">Aucun résultat sur Comick.io pour « {initialQuery} ».</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 2. CRUNCHYSCAN RESULTS SECTION */}
          {hasSearch && shouldSearchCrunchy && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/40">LelManga</Badge>
                    <span className="text-xs text-white/50 font-medium">Scans & Webtoons Français</span>
                  </div>
                  <h2 className="text-2xl font-bold font-japanese">Résultats LelManga</h2>
                </div>
              </div>

              {crunchyQuery.isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="aspect-[3/4] rounded-xl cover-skeleton" />
                  ))}
                </div>
              )}

              {!crunchyQuery.isLoading && !crunchyQuery.isError && crunchyQuery.data && (
                <div>
                  {crunchyQuery.data.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {crunchyQuery.data.map((item) => (
                        <div key={`crunchy-${item.id}`} className="relative group">
                          <span className="absolute z-10 top-2 left-2 badge-vf px-2 py-0.5 rounded-full text-[9px]">
                            Scan FR
                          </span>
                          <MangaCard
                            id={item.id}
                            title={item.title}
                            author="LelManga"
                            status="ongoing"
                            genre={item.genres}
                            imageUrl={item.coverUrl}
                            lastUpdate="VF"
                            externalUrl={item.url}
                            detailUrl={`/manga/${item.id}?source=crunchyscan`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">Aucun résultat sur LelManga pour « {initialQuery} ».</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 3. ORIGIN MANGA RESULTS SECTION */}
          {hasSearch && shouldSearchOrigin && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-manga-purple/30 text-white border-manga-purple/50">OriginManga</Badge>
                    <span className="text-xs text-white/50 font-medium">Scans Français · Lecteur In-App</span>
                  </div>
                  <h2 className="text-2xl font-bold font-japanese">Résultats OriginManga</h2>
                </div>
              </div>

              {originQuery.isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="aspect-[3/4] rounded-xl cover-skeleton" />
                  ))}
                </div>
              )}

              {!originQuery.isLoading && !originQuery.isError && originQuery.data && (
                <div>
                  {originQuery.data.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {originQuery.data.map((item) => (
                        <div key={`origin-${item.id}`} className="relative group">
                          <span className="absolute z-10 top-2 left-2 badge-vf px-2 py-0.5 rounded-full text-[9px]">
                            Scan FR
                          </span>
                          <MangaCard
                            id={item.id}
                            title={item.title}
                            author="OriginManga"
                            status="ongoing"
                            genre={[]}
                            imageUrl={item.coverUrl}
                            lastUpdate="Chapitres en ligne"
                            externalUrl={item.url}
                            detailUrl={`/manga/${item.id}?source=originmanga`}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">Aucun résultat sur OriginManga pour « {initialQuery} ».</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 4. ASURASCANS RESULTS SECTION */}
          {hasSearch && shouldSearchAsura && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">AsuraScans</Badge>
                    <span className="text-xs text-white/50 font-medium">Manhwas d'Action & Solo Leveling style</span>
                  </div>
                  <h2 className="text-2xl font-bold font-japanese">Résultats AsuraScans</h2>
                </div>
              </div>

              {asuraQuery.isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="aspect-[3/4] rounded-xl cover-skeleton" />
                  ))}
                </div>
              )}

              {!asuraQuery.isLoading && !asuraQuery.isError && asuraQuery.data && (
                <div>
                  {asuraQuery.data.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {asuraQuery.data.map((item) => (
                        <div key={`asura-${item.id}`} className="relative group">
                          <span className="absolute z-10 top-2 left-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white shadow">
                            Manhwa
                          </span>
                          <MangaCard
                            id={item.id}
                            title={item.title}
                            author="AsuraScans"
                            status="ongoing"
                            genre={['Manhwa', 'Action']}
                            imageUrl={item.coverUrl}
                            lastUpdate="Lecture externe"
                            externalUrl={item.url}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">Aucun résultat sur AsuraScans pour « {initialQuery} ».</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 5. MANGAFIRE RESULTS SECTION */}
          {hasSearch && shouldSearchMangaFire && (
            <section className="mb-14">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">MangaFire</Badge>
                    <span className="text-xs text-white/50 font-medium">Catalogue Élargi</span>
                  </div>
                  <h2 className="text-2xl font-bold font-japanese">Résultats MangaFire</h2>
                </div>
              </div>

              {mangaFireQuery.isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="aspect-[3/4] rounded-xl cover-skeleton" />
                  ))}
                </div>
              )}

              {!mangaFireQuery.isLoading && !mangaFireQuery.isError && mangaFireQuery.data && (
                <div>
                  {mangaFireQuery.data.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {mangaFireQuery.data.map((item) => (
                        <div key={`fire-${item.id}`} className="relative group">
                          <MangaCard
                            id={item.id}
                            title={item.title}
                            author="MangaFire"
                            status="ongoing"
                            genre={['Manga']}
                            imageUrl={item.coverUrl}
                            lastUpdate="Lecture externe"
                            externalUrl={item.url}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40">Aucun résultat sur MangaFire pour « {initialQuery} ».</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 6. MANGADEX RESULTS SECTION */}
          {hasSearch && shouldSearchMangaDex && (
            <section className="mb-14">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-manga-cyan/20 text-manga-cyan border-manga-cyan/40">MangaDex</Badge>
                    <span className="text-xs text-white/50 font-medium">Catalogue Principal</span>
                  </div>
                  <h2 className="text-2xl font-bold font-japanese">Résultats MangaDex</h2>
                </div>
                {mangaDexQuery.data && (
                  <p className="text-sm text-white/50">
                    <span className="text-white font-semibold">
                      {mangaDexQuery.data.total.toLocaleString('fr-FR')}
                    </span>{' '}
                    titre{mangaDexQuery.data.total > 1 ? 's' : ''} trouvé{mangaDexQuery.data.total > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {mangaDexQuery.isLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" aria-busy="true">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="aspect-[3/4] rounded-xl cover-skeleton" />
                  ))}
                </div>
              )}

              {mangaDexQuery.isError && (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
                  <h3 className="text-xl font-bold mb-2">MangaDex est temporairement indisponible</h3>
                  <p className="text-white/60 mb-6">{mangaDexQuery.error.message}</p>
                  <Button className="btn-gradient" onClick={() => mangaDexQuery.refetch()}>
                    Réessayer
                  </Button>
                </div>
              )}

              {!mangaDexQuery.isLoading && !mangaDexQuery.isError && mangaDexQuery.data && (
                <>
                  {mangaDexQuery.data.mangas.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {mangaDexQuery.data.mangas.map((manga) => (
                        <MangaCard
                          key={`dex-${manga.id}`}
                          id={manga.id}
                          title={manga.title}
                          author={manga.author}
                          status={manga.status}
                          genre={manga.genres}
                          imageUrl={manga.coverImageUrl}
                          lastUpdate={new Intl.DateTimeFormat('fr-FR', {
                            month: 'short',
                            year: 'numeric',
                          }).format(new Date(manga.updatedAt))}
                          externalUrl={manga.externalUrl}
                          detailUrl={`/manga/${manga.id}?source=mangadex`}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/5 py-12 px-6 text-center">
                      <h3 className="text-lg font-bold mb-2">Aucun résultat sur MangaDex</h3>
                      <p className="text-white/50 text-sm">Essayez un autre mot-clé ou filtre.</p>
                    </div>
                  )}

                  {totalMangaDexPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-10">
                      <Button
                        variant="outline"
                        className="border-white/30"
                        disabled={initialPage === 1}
                        onClick={() => goToPage(initialPage - 1)}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Précédent
                      </Button>
                      <span className="text-sm text-white/50">
                        {initialPage} / {totalMangaDexPages}
                      </span>
                      <Button
                        variant="outline"
                        className="border-white/30"
                        disabled={initialPage >= totalMangaDexPages}
                        onClick={() => goToPage(initialPage + 1)}
                      >
                        Suivant
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* 7. OTHER METADATA PROVIDERS (AniList, Jikan, Kitsu, Shikimori from public-apis) */}
          {hasSearch && providersQuery.data && providersQuery.data.length > 0 && selectedSource === 'all' && (
            <section className="mt-16 pt-10 border-t border-white/10" aria-labelledby="other-providers-title">
              <div className="mb-7">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-white/10 text-white/80 border-white/20">
                    <Globe className="h-3.5 w-3.5 mr-1" />
                    PUBLIC-APIS GITHUB
                  </Badge>
                </div>
                <h2 id="other-providers-title" className="text-3xl font-bold font-japanese">
                  Bases de données <span className="glow-text">globales</span>
                </h2>
                <p className="text-white/50 mt-1 text-sm">
                  Métadonnées et fiches officielles réunies depuis AniList, Shikimori, MyAnimeList (Jikan) et Kitsu.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {providersQuery.data.map((item) => (
                  <div key={`${item.provider}-${item.sourceId}`} className="relative">
                    <span className="absolute z-10 top-2 left-2 rounded-full bg-black/80 border border-white/20 px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/90">
                      {item.provider}
                    </span>
                    <MangaCard
                      id={`${item.provider}-${item.sourceId}`}
                      title={item.title}
                      author={
                        item.provider === 'shikimori'
                          ? 'Shikimori API'
                          : item.provider === 'jikan'
                          ? 'MyAnimeList via Jikan'
                          : item.provider === 'anilist'
                          ? 'AniList'
                          : 'Kitsu'
                      }
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

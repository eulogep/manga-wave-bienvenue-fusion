import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MangaCard from '@/components/MangaCard';
import MangaCoverSkeleton from '@/components/ui/MangaCoverSkeleton';
import { useMangaDexSearch } from '@/hooks/useMangaDex';
import { usePopularOriginManga } from '@/hooks/useOriginManga';
import {
  usePopularAsura,
  usePopularComick,
  usePopularCrunchyScan,
  usePopularMangaFire,
} from '@/hooks/useExternalSources';

type SourceTab = 'originmanga' | 'crunchyscan' | 'asurascans' | 'mangafire' | 'mangadex' | 'comick';

const TABS: Array<{ id: SourceTab; label: string; badge: string; color: string }> = [
  { id: 'originmanga', label: 'OriginManga', badge: 'Scans VF', color: 'from-blue-500 to-purple-600' },
  { id: 'crunchyscan', label: 'LelManga / VF', badge: 'Scans VF', color: 'from-orange-500 to-amber-500' },
  { id: 'asurascans', label: 'AsuraScans', badge: 'Manhwa EN', color: 'from-emerald-500 to-cyan-500' },
  { id: 'mangafire', label: 'MangaFire', badge: 'Manga EN', color: 'from-red-500 to-orange-500' },
  { id: 'mangadex', label: 'MangaDex', badge: 'Officiel', color: 'from-cyan-500 to-blue-600' },
  { id: 'comick', label: 'Comick.io', badge: 'Multi', color: 'from-purple-500 to-pink-500' },
];

const MultiSourceHubSection = () => {
  const [activeTab, setActiveTab] = useState<SourceTab>('originmanga');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Queries for the sources
  const comickQuery = usePopularComick();
  const originQuery = usePopularOriginManga();
  const crunchyQuery = usePopularCrunchyScan();
  const mangaDexQuery = useMangaDexSearch({ limit: 18, order: 'followedCount' });
  const mangaFireQuery = usePopularMangaFire();
  const asuraQuery = usePopularAsura();

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -480 : 480;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'comick':
        return {
          items: (comickQuery.data || []).map((item) => ({
            id: item.slug || item.id,
            title: item.title,
            coverUrl: item.coverUrl,
            author: 'Comick.io',
            rating: item.rating,
            genres: item.genres,
            lastUpdate: item.lastChapter ? `Ch. ${item.lastChapter}` : 'VF/EN',
            detailUrl: `/manga/${item.slug || item.id}?source=comick`,
            badge: 'Comick',
            badgeCls: 'bg-manga-purple/30 text-manga-purple-light border border-manga-purple/40',
          })),
          isLoading: comickQuery.isLoading,
          isError: comickQuery.isError,
          searchUrl: '/search?source=comick',
        };
      case 'originmanga':
        return {
          items: (originQuery.data || []).map((item) => ({
            id: item.id,
            title: item.title,
            coverUrl: item.coverUrl,
            author: 'OriginManga',
            rating: item.rating,
            genres: ['Scan FR'],
            lastUpdate: 'Chapitres VF',
            detailUrl: `/manga/${item.id}?source=originmanga`,
            badge: 'Scan VF',
            badgeCls: 'badge-vf',
          })),
          isLoading: originQuery.isLoading,
          isError: originQuery.isError,
          searchUrl: '/search?source=originmanga',
        };
      case 'crunchyscan':
        return {
          items: (crunchyQuery.data || []).map((item) => ({
            id: item.id,
            title: item.title,
            coverUrl: item.coverUrl,
            author: 'LelManga',
            rating: item.rating,
            genres: item.genres,
            lastUpdate: 'VF',
            detailUrl: `/manga/${item.id}?source=crunchyscan`,
            badge: 'Scan VF',
            badgeCls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
          })),
          isLoading: crunchyQuery.isLoading,
          isError: crunchyQuery.isError,
          searchUrl: '/search?source=crunchyscan',
        };
      case 'mangadex':
        return {
          items: (mangaDexQuery.data?.mangas || []).map((item) => ({
            id: item.id,
            title: item.title,
            coverUrl: item.coverImageUrl,
            author: item.author,
            rating: 4.9,
            genres: item.genres,
            lastUpdate: new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(new Date(item.updatedAt)),
            detailUrl: `/manga/${item.id}?source=mangadex`,
            badge: 'MangaDex',
            badgeCls: 'bg-manga-cyan/20 text-manga-cyan border border-manga-cyan/30',
          })),
          isLoading: mangaDexQuery.isLoading,
          isError: mangaDexQuery.isError,
          searchUrl: '/search?source=mangadex',
        };
      case 'mangafire':
        return {
          items: (mangaFireQuery.data || []).map((item) => ({
            id: item.id,
            title: item.title,
            coverUrl: item.coverUrl,
            author: 'MangaFire',
            rating: item.rating,
            genres: ['Manga', 'Manhwa'],
            lastUpdate: 'Chapitres EN',
            detailUrl: `/manga/${encodeURIComponent(item.id)}?source=mangafire`,
            badge: 'MangaFire',
            badgeCls: 'bg-red-500/20 text-red-300 border border-red-500/30',
          })),
          isLoading: mangaFireQuery.isLoading,
          isError: mangaFireQuery.isError,
          searchUrl: '/search?source=mangafire',
        };
      case 'asurascans':
        return {
          items: (asuraQuery.data || []).map((item) => ({
            id: item.id,
            title: item.title,
            coverUrl: item.coverUrl,
            author: 'AsuraScans',
            rating: item.rating,
            genres: ['Manhwa', 'Action'],
            lastUpdate: 'Chapitres EN',
            detailUrl: `/manga/${encodeURIComponent(item.id)}?source=asurascans`,
            badge: 'Asura',
            badgeCls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          })),
          isLoading: asuraQuery.isLoading,
          isError: asuraQuery.isError,
          searchUrl: '/search?source=asurascans',
        };
    }
  };

  const activeData = getActiveData();

  return (
    <section className="relative bg-[#08131d] py-14 section-padding" aria-labelledby="multi-source-title">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="mb-7 flex flex-col gap-4 border-b border-[var(--mw-border)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge className="border border-[var(--mw-accent-blue)]/35 bg-[var(--mw-accent-blue)]/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-[var(--mw-accent-blue)]">
                <Sparkles className="h-3 w-3 mr-1" />
                EXPLORATEUR MULTI-SOURCES
              </Badge>
              <span className="text-xs text-white/50">Directement depuis l'accueil</span>
            </div>
            <h2 id="multi-source-title" className="font-editorial text-3xl uppercase text-white md:text-4xl">
              Catalogue multi-sources
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--mw-text-secondary)]">
              Explorez et lisez instantanément le contenu de Comick.io, OriginManga, LelManga, MangaDex, MangaFire et AsuraScans.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="min-h-11 border-[var(--mw-border)] bg-transparent text-xs uppercase tracking-wider text-white hover:border-[var(--mw-accent-blue)]" asChild>
              <Link to={activeData.searchUrl}>
                Tout voir sur cette source <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Source Switcher Pills */}
        <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-[var(--mw-border)] hide-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--mw-accent-coral)] text-white'
                  : 'border-transparent text-[var(--mw-text-secondary)] hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="border border-[var(--mw-border)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--mw-text-secondary)]">
                {tab.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Horizontal Carousel */}
        <div className="relative group">
          {/* Scroll Left Button */}
          <button
            onClick={() => scroll('left')}
            className="absolute -left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-[var(--mw-border)] bg-[#06101a]/95 text-white opacity-0 transition-all group-hover:opacity-100 hover:border-[var(--mw-accent-coral)]"
            aria-label="Faire défiler vers la gauche"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Carousel Track */}
          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto px-1 py-2 scroll-smooth hide-scrollbar"
          >
            {activeData.isLoading ? (
              <div className="flex gap-4 w-full">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="min-w-[160px] sm:min-w-[190px] aspect-[3/4] rounded-2xl cover-skeleton" />
                ))}
              </div>
            ) : activeData.items.length === 0 ? (
              <div className="w-full py-12 text-center text-white/50 text-sm">
                Aucun contenu disponible pour cette source pour le moment.
              </div>
            ) : (
              activeData.items.map((manga, index) => (
                <div
                  key={`${activeTab}-${manga.id}`}
                  className="min-w-[165px] flex-shrink-0 animate-slide-up-fade sm:min-w-[190px] md:min-w-[205px]"
                  style={{ animationDelay: `${index * 0.04}s` }}
                >
                  <div className="relative">
                    <span className={`absolute z-10 top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${manga.badgeCls}`}>
                      {manga.badge}
                    </span>
                    <MangaCard
                      id={manga.id}
                      title={manga.title}
                      author={manga.author}
                      rating={manga.rating}
                      status="ongoing"
                      genre={manga.genres}
                      imageUrl={manga.coverUrl}
                      lastUpdate={manga.lastUpdate}
                      detailUrl={manga.detailUrl}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Scroll Right Button */}
          <button
            onClick={() => scroll('right')}
            className="absolute -right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-[var(--mw-border)] bg-[#06101a]/95 text-white opacity-0 transition-all group-hover:opacity-100 hover:border-[var(--mw-accent-coral)]"
            aria-label="Faire défiler vers la droite"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default MultiSourceHubSection;

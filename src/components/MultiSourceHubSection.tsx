import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Globe, Sparkles } from 'lucide-react';
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

type SourceTab = 'comick' | 'originmanga' | 'crunchyscan' | 'mangadex' | 'mangafire' | 'asurascans';

const TABS: Array<{ id: SourceTab; label: string; badge: string; color: string }> = [
  { id: 'comick', label: 'Comick.io', badge: 'VF & EN', color: 'from-purple-500 to-pink-500' },
  { id: 'originmanga', label: 'OriginManga', badge: 'Scans VF', color: 'from-blue-500 to-purple-600' },
  { id: 'crunchyscan', label: 'LelManga', badge: 'Scans VF', color: 'from-orange-500 to-amber-500' },
  { id: 'mangadex', label: 'MangaDex', badge: 'Officiel', color: 'from-cyan-500 to-blue-600' },
  { id: 'mangafire', label: 'MangaFire', badge: 'Multi', color: 'from-red-500 to-orange-500' },
  { id: 'asurascans', label: 'AsuraScans', badge: 'EN', color: 'from-emerald-500 to-cyan-500' },
];

const MultiSourceHubSection = () => {
  const [activeTab, setActiveTab] = useState<SourceTab>('comick');
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
    <section className="py-12 section-padding relative" aria-labelledby="multi-source-title">
      <div className="container mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-gradient-to-r from-manga-purple to-manga-cyan text-white border-0 text-xs px-2.5 py-0.5">
                <Sparkles className="h-3 w-3 mr-1" />
                EXPLORATEUR MULTI-SOURCES
              </Badge>
              <span className="text-xs text-white/50">Directement depuis l'accueil</span>
            </div>
            <h2 id="multi-source-title" className="text-2xl md:text-3xl font-bold font-outfit text-white">
              Catalogue <span className="glow-text">Multi-Sources</span>
            </h2>
            <p className="text-xs md:text-sm text-white/50 mt-1">
              Explorez et lisez instantanément le contenu de Comick.io, OriginManga, LelManga, MangaDex, MangaFire et AsuraScans.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="btn-outline-glow rounded-full text-xs" asChild>
              <Link to={activeData.searchUrl}>
                Tout voir sur cette source <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Source Switcher Pills */}
        <div className="flex items-center gap-2.5 overflow-x-auto hide-scrollbar pb-3 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 border ${
                activeTab === tab.id
                  ? 'bg-[#151c2c] text-white border-manga-purple shadow-glow-purple scale-105'
                  : 'bg-white/[0.04] text-white/60 border-white/[0.08] hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/80">
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
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-[#080c14]/90 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-manga-purple hover:border-manga-purple shadow-xl"
            aria-label="Faire défiler vers la gauche"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Carousel Track */}
          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto hide-scrollbar py-2 px-1 scroll-smooth"
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
                  className="min-w-[155px] sm:min-w-[185px] md:min-w-[200px] flex-shrink-0 animate-slide-up-fade"
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
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-[#080c14]/90 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-manga-purple hover:border-manga-purple shadow-xl"
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

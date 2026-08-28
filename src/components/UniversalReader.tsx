import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  BookOpen,
  ScrollText,
  X,
  SlidersHorizontal,
  Shuffle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useChapterSourceAlternatives, useUniversalChapterPages } from '@/hooks/useMangaReader';
import { useRecordReading } from '@/hooks/useReadingProgress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SourceChapter, SourceType } from '@/integrations/sources';

type Props = {
  source: SourceType | string;
  chapterId: string;
  chapterTitle?: string;
  mangaId?: string;
  mangaTitle?: string;
  mangaAuthor?: string | null;
  coverImage?: string | null;
  chapters?: SourceChapter[];
  initialPage?: number;
  onSelectChapter?: (chapterId: string) => void;
  onClose?: () => void;
};

type ReadingMode = 'paged' | 'webtoon';

const UniversalReader = ({
  source,
  chapterId,
  chapterTitle,
  mangaId,
  mangaTitle,
  mangaAuthor,
  coverImage,
  chapters = [],
  initialPage = 0,
  onSelectChapter,
  onClose,
}: Props) => {
  const { data: pages, isLoading, isError, error, refetch } = useUniversalChapterPages(source, chapterId);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [mode, setMode] = useState<ReadingMode>('paged');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fitWidth, setFitWidth] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { recordReading } = useRecordReading();

  // Find index of current chapter in list
  const currentChapterIndex = chapters.findIndex((c) => c.id === chapterId);
  const hasNextChapter = currentChapterIndex > 0; // usually descending order
  const hasPrevChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1;

  const currentChapterObj = chapters.find((c) => c.id === chapterId);
  const chapterNumber = currentChapterObj?.chapterNumber || '1';
  const displayTitle = chapterTitle || currentChapterObj?.title || `Chapitre ${chapterNumber}`;
  const alternativesQuery = useChapterSourceAlternatives(mangaTitle, chapterNumber, source, isError);

  useEffect(() => {
    setCurrentPage(initialPage);
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [chapterId, initialPage]);

  useEffect(() => {
    if (pages?.length && currentPage >= pages.length) {
      setCurrentPage(pages.length - 1);
    }
  }, [pages, currentPage]);

  // Record progress when page or chapter changes
  useEffect(() => {
    if (pages && pages.length > 0 && mangaTitle && mangaId) {
      recordReading.mutate({
        source,
        mangaId,
        mangaTitle,
        mangaAuthor,
        coverImage,
        chapterId,
        chapterNumber,
        chapterTitle: displayTitle,
        pageIndex: currentPage,
        totalPages: pages.length,
      });
    }
  }, [currentPage, pages?.length, chapterId, source, mangaId, mangaTitle]);

  const handleNextChapter = useCallback(() => {
    if (hasNextChapter && onSelectChapter) {
      onSelectChapter(chapters[currentChapterIndex - 1].id);
    }
  }, [hasNextChapter, onSelectChapter, chapters, currentChapterIndex]);

  const handlePrevChapter = useCallback(() => {
    if (hasPrevChapter && onSelectChapter) {
      onSelectChapter(chapters[currentChapterIndex + 1].id);
    }
  }, [hasPrevChapter, onSelectChapter, chapters, currentChapterIndex]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
    } else if (hasPrevChapter) {
      handlePrevChapter();
    }
  }, [currentPage, hasPrevChapter, handlePrevChapter]);

  const handleNextPage = useCallback(() => {
    if (pages && currentPage < pages.length - 1) {
      setCurrentPage((p) => p + 1);
    } else if (hasNextChapter) {
      handleNextChapter();
    }
  }, [currentPage, pages, hasNextChapter, handleNextChapter]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'paged') {
        if (e.key === 'ArrowLeft') {
          handlePrevPage();
        } else if (e.key === 'ArrowRight' || e.key === ' ') {
          if (e.key === ' ') e.preventDefault();
          handleNextPage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handlePrevPage, handleNextPage]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const progressPercent = pages && pages.length > 0 ? Math.round(((currentPage + 1) / pages.length) * 100) : 0;

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-white/15 bg-[#0d0f17] text-white shadow-2xl overflow-hidden"
    >
      {/* Reading Progress Line */}
      {pages && pages.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-40">
          <div
            className="h-full bg-gradient-to-r from-manga-purple to-manga-cyan transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0d0f17]/95 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className="bg-manga-purple/30 text-manga-purple border border-manga-purple/40 shrink-0 capitalize">
            {source}
          </Badge>
          <div className="min-w-0">
            {mangaTitle && <p className="text-xs text-muted-foreground truncate">{mangaTitle}</p>}
            <h3 className="font-bold text-sm md:text-base truncate">{displayTitle}</h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Chapter Selector Dropdown if chapters list is available */}
          {chapters.length > 0 && onSelectChapter && (
            <div className="hidden sm:block">
              <Select value={chapterId} onValueChange={onSelectChapter}>
                <SelectTrigger className="h-8 text-xs bg-white/10 border-white/20 w-44">
                  <SelectValue placeholder="Choisir un chapitre" />
                </SelectTrigger>
                <SelectContent className="bg-manga-dark border-white/20 max-h-60">
                  {chapters.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id} className="text-xs">
                      Ch. {ch.chapterNumber} {ch.title ? `— ${ch.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reading Mode Switcher */}
          <div className="flex items-center rounded-lg bg-white/10 p-0.5 border border-white/15">
            <button
              type="button"
              onClick={() => setMode('paged')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'paged' ? 'bg-manga-purple text-white shadow' : 'text-muted-foreground hover:text-white'
              }`}
              title="Mode Page par Page"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Pages</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('webtoon')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'webtoon' ? 'bg-manga-purple text-white shadow' : 'text-muted-foreground hover:text-white'
              }`}
              title="Mode Webtoon (Défilement continu)"
            >
              <ScrollText className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Webtoon</span>
            </button>
          </div>

          {/* Size fit toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-white"
            onClick={() => setFitWidth((v) => !v)}
            title={fitWidth ? 'Ajuster à la hauteur' : 'Ajuster à la largeur'}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-white"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {/* Close button */}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onClose}
              title="Fermer le lecteur"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 md:p-6 min-h-[60vh] flex flex-col items-center justify-center">
        {isLoading && (
          <div className="py-24 text-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-manga-cyan mx-auto mb-4" />
            <p className="text-lg font-semibold">Chargement des pages…</p>
            <p className="text-sm text-muted-foreground mt-1">Source : {source}</p>
          </div>
        )}

        {isError && (
          <div className="py-16 px-6 text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h4 className="text-lg font-bold mb-2">Impossible de charger le chapitre</h4>
            <p className="text-sm text-muted-foreground mb-6">
              {error?.message || 'Erreur lors de la récupération des images du chapitre.'}
            </p>
            <Button className="btn-gradient" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Réessayer
            </Button>
            {mangaTitle && (
              <div className="mt-8 pt-6 border-t border-white/10 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <Shuffle className="h-4 w-4 text-manga-cyan" />
                  <h5 className="font-semibold text-sm">Changer de source</h5>
                </div>
                {alternativesQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Recherche du chapitre sur les autres sources…
                  </div>
                ) : alternativesQuery.data?.length ? (
                  <div className="space-y-2">
                    {alternativesQuery.data.map((alternative) => {
                      const target = alternative.chapter
                        ? `/read/${encodeURIComponent(alternative.source)}/${encodeURIComponent(alternative.mangaId)}/${encodeURIComponent(alternative.chapter.id)}`
                        : `/manga/${encodeURIComponent(alternative.mangaId)}?source=${encodeURIComponent(alternative.source)}`;
                      return (
                        <Button
                          key={`${alternative.source}-${alternative.mangaId}`}
                          variant="outline"
                          size="sm"
                          className="w-full justify-between border-white/20 text-xs"
                          asChild
                        >
                          <Link to={target}>
                            <span>{alternative.sourceName}</span>
                            <span className={alternative.chapter ? 'text-emerald-400' : 'text-amber-400'}>
                              {alternative.chapter
                                ? `Chapitre ${alternative.chapter.chapterNumber} disponible`
                                : 'Voir les chapitres'}
                            </span>
                          </Link>
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Ce chapitre exact n’a pas été retrouvé automatiquement sur une autre source.
                    </p>
                    <Button variant="outline" size="sm" className="w-full border-white/20 text-xs" asChild>
                      <Link to={`/search?q=${encodeURIComponent(mangaTitle)}`}>
                        Rechercher sur toutes les sources
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!isLoading && !isError && (!pages || pages.length === 0) && (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-base">Aucune page trouvée pour ce chapitre.</p>
          </div>
        )}

        {/* PAGED MODE */}
        {!isLoading && !isError && pages && pages.length > 0 && mode === 'paged' && (
          <div className="w-full flex flex-col items-center gap-6">
            <div
              className={`relative flex justify-center cursor-pointer select-none group w-full ${
                fitWidth ? 'max-w-5xl' : 'max-w-3xl'
              }`}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                if (clickX < rect.width / 2) {
                  handlePrevPage();
                } else {
                  handleNextPage();
                }
              }}
            >
              <img
                src={pages[currentPage]}
                alt={`Page ${currentPage + 1}`}
                referrerPolicy="no-referrer"
                className={`rounded-lg shadow-2xl border border-white/10 ${
                  fitWidth ? 'w-full h-auto' : 'max-h-[80vh] w-auto object-contain'
                }`}
                loading="eager"
                onError={(e) => {
                  const target = e.currentTarget;
                  const currentSrc = target.src;
                  if (!currentSrc.includes('/api/extract/image-proxy') && pages[currentPage]) {
                    target.src = `/api/extract/image-proxy?url=${encodeURIComponent(pages[currentPage])}`;
                  }
                }}
              />

              {/* Hover Navigation Indicators */}
              <div className="absolute inset-y-0 left-0 w-1/4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start pl-4 pointer-events-none">
                <span className="p-2 rounded-full bg-black/70 text-white backdrop-blur-sm shadow">
                  <ChevronLeft className="h-6 w-6" />
                </span>
              </div>
              <div className="absolute inset-y-0 right-0 w-1/4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pr-4 pointer-events-none">
                <span className="p-2 rounded-full bg-black/70 text-white backdrop-blur-sm shadow">
                  <ChevronRight className="h-6 w-6" />
                </span>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full border-t border-white/10 pt-4">
              {hasPrevChapter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-xs"
                  onClick={handlePrevChapter}
                >
                  Chapitre précédent
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-xs"
                disabled={currentPage === 0 && !hasPrevChapter}
                onClick={handlePrevPage}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Précédente
              </Button>

              <span className="text-xs px-3 py-1.5 rounded-md bg-white/10 font-medium">
                Page {currentPage + 1} / {pages.length} ({progressPercent}%)
              </span>

              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-xs"
                disabled={currentPage >= pages.length - 1 && !hasNextChapter}
                onClick={handleNextPage}
              >
                Suivante <ChevronRight className="h-4 w-4 ml-1" />
              </Button>

              {hasNextChapter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-xs"
                  onClick={handleNextChapter}
                >
                  Chapitre suivant
                </Button>
              )}
            </div>
          </div>
        )}

        {/* WEBTOON / CONTINUOUS VERTICAL SCROLL MODE */}
        {!isLoading && !isError && pages && pages.length > 0 && mode === 'webtoon' && (
          <div className="w-full flex flex-col items-center gap-2 max-w-3xl">
            {pages.map((url, idx) => (
              <div key={url} className="relative w-full flex justify-center">
                <img
                  src={url}
                  alt={`Page ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-contain rounded shadow-lg border border-white/5"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget;
                    const currentSrc = target.src;
                    if (!currentSrc.includes('/api/extract/image-proxy')) {
                      target.src = `/api/extract/image-proxy?url=${encodeURIComponent(url)}`;
                    }
                  }}
                />
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white/70">
                  {idx + 1}/{pages.length}
                </span>
              </div>
            ))}

            {/* End of chapter buttons */}
            <div className="flex items-center justify-center gap-4 py-8 border-t border-white/10 w-full mt-6">
              {hasPrevChapter && (
                <Button variant="outline" className="border-white/20" onClick={handlePrevChapter}>
                  Chapitre précédent
                </Button>
              )}
              {hasNextChapter && (
                <Button className="btn-gradient" onClick={handleNextChapter}>
                  Chapitre suivant
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalReader;

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  SlidersHorizontal,
  Shuffle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useChapterSourceAlternatives,
  useUniversalChapterPages,
  type ChapterSourceAlternative,
} from '@/hooks/useMangaReader';
import { useRecordReading } from '@/hooks/useReadingProgress';
import { useReaderPreferences } from '@/hooks/useReaderPreferences';
import { useReaderPreloading } from '@/hooks/useReaderPreloading';
import ReaderSettingsPanel from '@/components/reader/ReaderSettingsPanel';
import { shouldFallbackHeightToWidth, type PageFitMeasurement } from '@/components/reader/pageFit';
import { selectAutomaticFallback } from '@/domain/automaticFallback';
import { moveReaderPage } from '@/domain/readerNavigation';
import { nextReaderSettingsState } from '@/domain/readerUiState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSource, type SourceChapter, type SourceType } from '@/integrations/sources';

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
  language?: string;
  onSelectChapter?: (chapterId: string) => void;
  triedSources?: string[];
  autoFallbackApplied?: boolean;
  onAutomaticSourceFallback?: (alternative: ChapterSourceAlternative, pageIndex: number) => void;
  onManualSourceSelection?: (alternative: ChapterSourceAlternative, pageIndex: number) => void;
  onPageChange?: (pageIndex: number) => void;
  fallbackNotice?: string | null;
  onClose?: () => void;
};

const MODE_LABELS = {
  vertical: 'Vertical',
  webtoon: 'Webtoon',
  single_page: 'Page simple',
  double_page: 'Double page',
  manga_rtl: 'Manga RTL',
  comic_ltr: 'Comic LTR',
} as const;

const BACKGROUND_COLORS = {
  ink: '#061622',
  night: '#141c28',
  paper: '#d9d4c8',
} as const;

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
  language = 'fr',
  onSelectChapter,
  triedSources = [],
  autoFallbackApplied = false,
  onAutomaticSourceFallback,
  onManualSourceSelection,
  onPageChange,
  fallbackNotice,
  onClose,
}: Props) => {
  const { data: pages, isLoading, isError, error, refetch } = useUniversalChapterPages(source, chapterId);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [continuousPageCount, setContinuousPageCount] = useState(0);
  const [fallbackTargetSource, setFallbackTargetSource] = useState<string | null>(null);
  const [showFallbackSuccess, setShowFallbackSuccess] = useState(autoFallbackApplied);
  const [pageMeasurements, setPageMeasurements] = useState<Record<number, PageFitMeasurement>>({});
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  }));
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const continuousSentinelRef = useRef<HTMLDivElement>(null);
  const resumedChapterRef = useRef<string>();
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackAttemptRef = useRef<string | null>(null);
  const { recordReading } = useRecordReading();
  const { preferences, updatePreferences, resetPreferences } = useReaderPreferences();
  const isContinuous = preferences.mode === 'vertical' || preferences.mode === 'webtoon';
  const isDoublePage = preferences.mode === 'double_page';
  const isDoublePageLayout = isDoublePage && viewport.width >= 640;
  const readingDirection = preferences.mode === 'manga_rtl'
    ? 'rtl'
    : preferences.mode === 'comic_ltr'
      ? 'ltr'
      : preferences.readingDirection;
  const pageStep = isDoublePageLayout ? 2 : 1;
  const showControls = controlsVisible || settingsOpen;

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setControlsVisible(false), 2_400);
  }, []);

  useEffect(() => {
    revealControls();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [revealControls]);

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    setPageMeasurements({});
  }, [chapterId]);

  // Find index of current chapter in list
  const currentChapterIndex = chapters.findIndex((c) => c.id === chapterId);
  const hasNextChapter = currentChapterIndex > 0; // usually descending order
  const hasPrevChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1;
  const nextChapterId = hasNextChapter ? chapters[currentChapterIndex - 1].id : undefined;

  useReaderPreloading({
    pages,
    currentPage,
    preloadCount: preferences.preloadCount,
    sourceId: source,
    nextChapterId,
  });

  useEffect(() => {
    const total = pages?.length || 0;
    const initialCount = Math.min(total, Math.max(initialPage + preferences.preloadCount + 1, preferences.preloadCount + 2));
    setContinuousPageCount(initialCount);
  }, [chapterId, initialPage, pages?.length, preferences.preloadCount]);

  useEffect(() => {
    if (!isContinuous || !continuousSentinelRef.current || !pages?.length) return;
    const sentinel = continuousSentinelRef.current;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setContinuousPageCount((count) => Math.min(pages.length, count + Math.max(3, preferences.preloadCount)));
    }, { root: contentRef.current, rootMargin: '600px 0px', threshold: 0.01 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isContinuous, pages, preferences.preloadCount]);

  useEffect(() => {
    const root = contentRef.current;
    if (!isContinuous || !root) return;
    const pageElements = root.querySelectorAll<HTMLElement>('[data-reader-page]');
    if (pageElements.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const index = Number((visible?.target as HTMLElement | undefined)?.dataset.readerPage);
      if (Number.isInteger(index)) setCurrentPage(index);
    }, { root, threshold: [0.35, 0.6, 0.85] });
    pageElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [continuousPageCount, isContinuous]);

  const currentChapterObj = chapters.find((c) => c.id === chapterId);
  const chapterNumber = currentChapterObj?.chapterNumber;
  const displayTitle = chapterTitle || currentChapterObj?.title || (chapterNumber ? `Chapitre ${chapterNumber}` : 'Chapitre');
  const alternativesQuery = useChapterSourceAlternatives(
    mangaTitle,
    chapterNumber,
    source,
    language,
    isError || settingsOpen,
  );

  useEffect(() => {
    fallbackAttemptRef.current = null;
    setFallbackTargetSource(null);
  }, [chapterId, source]);

  useEffect(() => {
    if (!autoFallbackApplied) return;
    setShowFallbackSuccess(true);
    const timer = window.setTimeout(() => setShowFallbackSuccess(false), 3_500);
    return () => window.clearTimeout(timer);
  }, [autoFallbackApplied, chapterId, source]);

  useEffect(() => {
    if (!isError || !onAutomaticSourceFallback || !alternativesQuery.data) return;
    const target = selectAutomaticFallback(alternativesQuery.data, source, triedSources, undefined, language);
    if (!target || fallbackAttemptRef.current) return;

    fallbackAttemptRef.current = target.source;
    setFallbackTargetSource(target.sourceName);
    const timer = window.setTimeout(() => onAutomaticSourceFallback(target, currentPage), 700);
    return () => window.clearTimeout(timer);
  }, [alternativesQuery.data, currentPage, isError, language, onAutomaticSourceFallback, source, triedSources]);

  useEffect(() => {
    setCurrentPage(initialPage);
    resumedChapterRef.current = undefined;
  }, [chapterId, initialPage]);

  useEffect(() => {
    const resumeKey = `${chapterId}:${isContinuous}`;
    if (resumedChapterRef.current === resumeKey) return;
    const isModeSwitch = resumedChapterRef.current?.startsWith(`${chapterId}:`);
    const targetPage = isModeSwitch ? currentPage : initialPage;
    const frame = requestAnimationFrame(() => {
      if (isContinuous && targetPage > 0) {
        const page = contentRef.current?.querySelector<HTMLElement>(`[data-reader-page="${targetPage}"]`);
        if (!page) {
          setContinuousPageCount((count) => Math.min(
            pages?.length || count,
            Math.max(count, targetPage + preferences.preloadCount + 1),
          ));
          return;
        }
        page.scrollIntoView({ block: 'start' });
      } else if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      resumedChapterRef.current = resumeKey;
    });
    return () => cancelAnimationFrame(frame);
  }, [chapterId, continuousPageCount, currentPage, initialPage, isContinuous, pages?.length, preferences.preloadCount]);

  useEffect(() => {
    if (pages?.length && currentPage >= pages.length) {
      setCurrentPage(pages.length - 1);
    }
  }, [pages, currentPage]);

  // Record progress when page or chapter changes
  useEffect(() => {
    if (pages && pages.length > 0 && mangaTitle && mangaId && chapterNumber) {
      recordReading.mutate({
        source,
        mangaId,
        mangaTitle,
        mangaAuthor,
        coverImage,
        chapterId,
        chapterNumber: chapterNumber || '',
        language,
        chapterTitle: displayTitle,
        pageIndex: currentPage,
        totalPages: pages.length,
      });
    }
  }, [chapterId, chapterNumber, coverImage, currentPage, displayTitle, language, mangaAuthor, mangaId, mangaTitle, pages, recordReading, source]);

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

  const commitPage = useCallback((nextPage: number) => {
    if (nextPage === currentPage) return;
    setCurrentPage(nextPage);
    onPageChange?.(nextPage);
  }, [currentPage, onPageChange]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 0) {
      commitPage(moveReaderPage(currentPage, pages?.length || 0, 'previous', pageStep));
    } else if (hasPrevChapter) {
      handlePrevChapter();
    }
  }, [commitPage, currentPage, hasPrevChapter, handlePrevChapter, pageStep, pages?.length]);

  const handleNextPage = useCallback(() => {
    if (pages && currentPage < pages.length - 1) {
      commitPage(moveReaderPage(currentPage, pages.length, 'next', pageStep));
    } else if (hasNextChapter) {
      handleNextChapter();
    }
  }, [commitPage, currentPage, pages, hasNextChapter, handleNextChapter, pageStep]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      revealControls();
      if (!isContinuous && !settingsOpen) {
        const nextKey = readingDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
        const previousKey = readingDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        if (e.key === previousKey) {
          handlePrevPage();
        } else if (e.key === nextKey || e.key === ' ') {
          if (e.key === ' ') e.preventDefault();
          handleNextPage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPage, handleNextPage, isContinuous, readingDirection, revealControls, settingsOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
  const visiblePageIndices = pages
    ? [currentPage, ...(isDoublePageLayout && currentPage + 1 < pages.length ? [currentPage + 1] : [])]
    : [];

  const usesWidthFit = (pageIndex: number) => {
    if (preferences.fitMode === 'width') return true;
    if (preferences.fitMode !== 'height') return false;
    const measurement = pageMeasurements[pageIndex];
    return measurement ? shouldFallbackHeightToWidth({ ...measurement, viewportWidth: viewport.width, viewportHeight: viewport.height }) : false;
  };

  const imageFitClass = (pageIndex: number) => usesWidthFit(pageIndex)
    ? 'h-auto w-full max-w-full flex-none object-contain'
    : preferences.fitMode === 'original'
      ? 'h-auto w-auto max-w-full flex-none object-contain'
      : 'h-auto w-auto max-w-full flex-none object-contain max-h-[calc(100dvh-8rem)]';

  return (
    <div
      ref={containerRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[var(--mw-background)] text-[var(--mw-text-primary)]"
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onTouchStart={revealControls}
      style={{ backgroundColor: BACKGROUND_COLORS[preferences.background] }}
    >
      {/* Reading Progress Line */}
      {pages && pages.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-40">
          <div
            className="h-full bg-[var(--mw-brand-primary)] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {showFallbackSuccess && (
        <div role="status" aria-live="polite" className="fixed left-1/2 top-20 z-40 -translate-x-1/2 border border-emerald-400/30 bg-emerald-950/95 px-4 py-2 text-xs font-medium text-emerald-200 shadow-xl backdrop-blur-md">
          {fallbackNotice || 'Source alternative chargée.'}
        </div>
      )}

      {/* Top Navigation Bar */}
      <div
        className={`absolute inset-x-0 top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#061622]/94 px-3 py-2 backdrop-blur-md transition-[opacity,transform] duration-200 md:px-5 ${
          showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={onClose}
              aria-label="Retour à la fiche manga"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <Badge className="hidden shrink-0 border border-[#1ea7ff]/35 bg-[#1ea7ff]/15 text-[#1ea7ff] capitalize min-[430px]:inline-flex">
            {source}
          </Badge>
          <div className="min-w-0">
            {mangaTitle && <p className="text-xs text-muted-foreground truncate">{mangaTitle}</p>}
            <h3 className="font-bold text-sm md:text-base truncate">{displayTitle}</h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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

          <Button
            variant="ghost"
            size="sm"
            className="h-11 gap-2 px-3 text-[var(--mw-text-secondary)] hover:bg-white/10 hover:text-white"
            onClick={() => setSettingsOpen((current) => nextReaderSettingsState(current, 'open'))}
            aria-expanded={settingsOpen}
            aria-label="Ouvrir les réglages du lecteur"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden lg:inline">{MODE_LABELS[preferences.mode]}</span>
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-muted-foreground hover:text-white"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={contentRef}
        className="flex h-full flex-col items-center justify-start overflow-y-auto overscroll-contain px-0 pb-32 pt-16 sm:pb-16 md:px-4"
      >
        {isLoading && (
          <div className="py-24 text-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-manga-cyan mx-auto mb-4" />
            <p className="text-lg font-semibold">Chargement des pages…</p>
            <p className="text-sm text-muted-foreground mt-1">Source : {source}</p>
          </div>
        )}

        {isError && (
          <div className="max-w-md px-6 py-16 text-center" aria-live="polite">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h4 className="mb-2 text-lg font-bold">
              {alternativesQuery.isLoading || fallbackTargetSource
                ? 'Cette source répond lentement.'
                : 'Ce chapitre n’est pas disponible sur les autres sources.'}
            </h4>
            <p className="mb-6 text-sm text-muted-foreground">
              {fallbackTargetSource
                ? `Nous chargeons automatiquement ${fallbackTargetSource}…`
                : alternativesQuery.isLoading
                  ? 'Nous essayons une autre source…'
                  : 'Réessayez ou choisissez une autre source disponible ci-dessous.'}
            </p>
            {!alternativesQuery.isLoading && !fallbackTargetSource && error?.message && (
              <details className="mb-5 text-left text-xs text-white/45">
                <summary className="cursor-pointer">Détail technique</summary>
                <p className="mt-2 break-words">{error.message}</p>
              </details>
            )}
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
                    {alternativesQuery.data.map((alternative, alternativeIndex) => {
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
                            <span className="flex min-w-0 flex-col items-start">
                              <span className="truncate">{alternative.sourceName}</span>
                              <span className="text-[10px] font-normal text-white/45">
                                {alternativeIndex === 0 && alternative.chapter ? 'Recommandée · ' : ''}Score {Math.round(alternative.sourceScore)}/100
                              </span>
                            </span>
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

        {/* PAGED MODES */}
        {!isLoading && !isError && pages && pages.length > 0 && !isContinuous && (
          <div className="flex min-h-full w-full flex-col items-center justify-center gap-6">
            <div
              className={`group relative flex w-full cursor-pointer select-none items-start justify-center ${
                isDoublePageLayout ? 'max-w-[min(96vw,1500px)]' : 'max-w-5xl'
              } ${readingDirection === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
              style={{ gap: `${preferences.pageGap}px` }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickedLeft = clickX < rect.width / 2;
                const goNext = readingDirection === 'rtl' ? clickedLeft : !clickedLeft;
                if (goNext) handleNextPage();
                else handlePrevPage();
              }}
            >
              {visiblePageIndices.map((pageIndex) => (
                <img
                  key={`${chapterId}-${pageIndex}`}
                  src={pages[pageIndex]}
                  alt={`Page ${pageIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className={`border border-white/10 shadow-2xl ${imageFitClass(pageIndex)}`}
                  data-fit-mode={usesWidthFit(pageIndex) ? 'width' : preferences.fitMode}
                  data-fit-fallback={preferences.fitMode === 'height' && usesWidthFit(pageIndex) ? 'width' : undefined}
                  style={{
                    filter: `brightness(${preferences.brightness})`,
                    maxWidth: isDoublePageLayout ? 'calc(50% - 4px)' : undefined,
                    transform: `scale(${preferences.zoom})`,
                    transformOrigin: 'center top',
                  }}
                  loading="eager"
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    const rect = image.getBoundingClientRect();
                    const measurement = {
                      naturalWidth: image.naturalWidth,
                      naturalHeight: image.naturalHeight,
                      renderedWidth: rect.width,
                      renderedHeight: rect.height,
                    };
                    setPageMeasurements((current) => {
                      const previous = current[pageIndex];
                      if (previous
                        && previous.naturalWidth === measurement.naturalWidth
                        && previous.naturalHeight === measurement.naturalHeight
                        && Math.abs(previous.renderedWidth - measurement.renderedWidth) < 1
                        && Math.abs(previous.renderedHeight - measurement.renderedHeight) < 1) return current;
                      return { ...current, [pageIndex]: measurement };
                    });
                  }}
                  onError={(event) => {
                    const target = event.currentTarget;
                    const currentSrc = target.src;
                    if (!currentSrc.includes('/api/extract/image-proxy') && pages[pageIndex]) {
                      target.src = `/api/extract/image-proxy?url=${encodeURIComponent(pages[pageIndex])}`;
                    }
                  }}
                />
              ))}

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
            <div
              className={`fixed inset-x-0 bottom-0 z-30 flex min-h-16 flex-col items-center justify-center gap-2 border-t border-white/10 bg-[#061622]/94 px-3 py-2 backdrop-blur-md transition-[opacity,transform] duration-200 sm:flex-row sm:flex-wrap ${
                showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
              }`}
            >
              {hasPrevChapter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-11 border-white/20 text-xs sm:inline-flex"
                  onClick={handlePrevChapter}
                >
                  Chapitre précédent
                </Button>
              )}

              <div className="flex w-full items-center justify-center gap-2 sm:contents">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-w-11 border-white/20 px-3 text-xs"
                  disabled={currentPage === 0 && !hasPrevChapter}
                  onClick={handlePrevPage}
                  aria-label="Page précédente"
                >
                  <ChevronLeft className="h-4 w-4 min-[430px]:mr-1" />
                  <span className="hidden min-[430px]:inline">Précédente</span>
                </Button>

                <span className="whitespace-nowrap rounded-md bg-white/10 px-2 py-2 text-[11px] font-medium sm:px-3 sm:text-xs">
                  Page {currentPage + 1} / {pages.length} ({progressPercent}%)
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-w-11 border-white/20 px-3 text-xs"
                  disabled={currentPage >= pages.length - 1 && !hasNextChapter}
                  onClick={handleNextPage}
                  aria-label="Page suivante"
                >
                  <span className="hidden min-[430px]:inline">Suivante</span>
                  <ChevronRight className="h-4 w-4 min-[430px]:ml-1" />
                </Button>
              </div>

              {(hasPrevChapter || hasNextChapter) && (
                <div className="flex w-full items-center justify-center gap-2 sm:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 flex-1 border-white/20 text-xs"
                    disabled={!hasPrevChapter}
                    onClick={handlePrevChapter}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Chap. précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 flex-1 border-white/20 text-xs"
                    disabled={!hasNextChapter}
                    onClick={handleNextChapter}
                  >
                    Chap. suivant <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}

              {hasNextChapter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-11 border-white/20 text-xs sm:inline-flex"
                  onClick={handleNextChapter}
                >
                  Chapitre suivant
                </Button>
              )}
            </div>
          </div>
        )}

        {/* CONTINUOUS MODES */}
        {!isLoading && !isError && pages && pages.length > 0 && isContinuous && (
          <div
            className="flex w-full max-w-3xl flex-col items-center"
            style={{ gap: preferences.mode === 'webtoon' ? 0 : `${preferences.pageGap}px` }}
          >
            {pages.slice(0, continuousPageCount).map((url, idx) => (
              <div key={url} data-reader-page={idx} className="relative w-full flex justify-center">
                <img
                  src={url}
                  alt={`Page ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className={`h-auto w-full object-contain shadow-lg ${preferences.mode === 'webtoon' ? '' : 'rounded-lg border border-white/5'}`}
                  style={{ filter: `brightness(${preferences.brightness})`, transform: `scale(${preferences.zoom})`, transformOrigin: 'center top' }}
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

            {continuousPageCount < pages.length && (
              <div
                ref={continuousSentinelRef}
                className="flex h-24 w-full items-center justify-center gap-2 text-sm text-[var(--mw-text-secondary)]"
              >
                <LoaderCircle className="h-4 w-4 animate-spin text-[var(--mw-accent-blue)]" />
                Chargement de la suite…
              </div>
            )}

            {/* End of chapter buttons */}
            <div className="mt-6 flex w-full flex-wrap items-center justify-center gap-3 border-t border-white/10 px-3 py-8">
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
      {settingsOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/55"
            onClick={() => setSettingsOpen((current) => nextReaderSettingsState(current, 'close'))}
            aria-label="Fermer les réglages"
          />
          <ReaderSettingsPanel
            preferences={preferences}
            onChange={updatePreferences}
            onReset={resetPreferences}
            onClose={() => setSettingsOpen((current) => nextReaderSettingsState(current, 'close'))}
            currentSource={String(source)}
            currentSourceLanguage={language || getSource(source)?.lang || 'und'}
            sourceAlternatives={alternativesQuery.data || []}
            sourceAlternativesLoading={alternativesQuery.isLoading}
            onSelectSource={(alternative) => {
              setSettingsOpen((current) => nextReaderSettingsState(current, 'close'));
              onManualSourceSelection?.(alternative, currentPage);
            }}
          />
        </>
      )}
    </div>
  );
};

export default UniversalReader;

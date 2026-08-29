import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Maximize2, Minimize2, RefreshCw, AlertCircle } from 'lucide-react';
import { useOriginMangaPages } from '@/hooks/useOriginManga';
import { useRecordReading } from '@/hooks/useReadingProgress';
import { Button } from '@/components/ui/button';

type Props = {
  chapterId: string;
  chapterTitle: string;
  chapterNumber?: string;
  mangaId?: string;
  mangaTitle?: string;
  coverImage?: string | null;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
  hasNextChapter?: boolean;
  hasPrevChapter?: boolean;
  onClose?: () => void;
};

const OriginMangaReader = ({
  chapterId,
  chapterTitle,
  chapterNumber = '1',
  mangaId,
  mangaTitle,
  coverImage,
  onNextChapter,
  onPrevChapter,
  hasNextChapter = false,
  hasPrevChapter = false,
  onClose,
}: Props) => {
  const { data: pages, isLoading, isError, error, refetch } = useOriginMangaPages(chapterId);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { recordReading } = useRecordReading();

  // Reset page index when chapterId changes
  useEffect(() => {
    setCurrentPage(0);
  }, [chapterId]);

  // Record reading progress
  useEffect(() => {
    if (pages && pages.length > 0 && mangaTitle && mangaId) {
      recordReading.mutate({
        source: 'originmanga',
        mangaId,
        mangaTitle,
        coverImage,
        chapterId,
        chapterNumber,
        chapterTitle,
        pageIndex: currentPage,
        totalPages: pages.length,
      });
    }
  }, [chapterId, chapterNumber, chapterTitle, coverImage, currentPage, mangaId, mangaTitle, pages, recordReading]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
    } else if (hasPrevChapter && onPrevChapter) {
      onPrevChapter();
    }
  }, [currentPage, hasPrevChapter, onPrevChapter]);

  const handleNextPage = useCallback(() => {
    if (pages && currentPage < pages.length - 1) {
      setCurrentPage((p) => p + 1);
    } else if (hasNextChapter && onNextChapter) {
      onNextChapter();
    }
  }, [currentPage, pages, hasNextChapter, onNextChapter]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevPage();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        if (e.key === ' ') e.preventDefault();
        handleNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevPage, handleNextPage]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center rounded-2xl border border-white/10 bg-card/40 backdrop-blur-sm">
        <LoaderCircle className="h-10 w-10 animate-spin text-manga-purple mx-auto mb-4" />
        <p className="text-white font-medium">Chargement du chapitre…</p>
        <p className="text-sm text-muted-foreground mt-1">Récupération des pages depuis OriginManga</p>
      </div>
    );
  }

  if (isError || !pages || pages.length === 0) {
    return (
      <div className="py-14 px-6 text-center rounded-2xl border border-destructive/30 bg-destructive/10">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h4 className="text-lg font-bold text-white mb-2">Chapitre indisponible sur OriginManga</h4>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
          {error?.message || "Les pages de ce chapitre n'ont pas pu être chargées via le proxy OriginManga."}
        </p>
        <Button variant="outline" className="border-white/20" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-4 md:p-6 shadow-2xl">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="min-w-0">
          <span className="text-xs uppercase tracking-wider text-manga-cyan font-semibold block mb-1">
            Lecteur OriginManga
          </span>
          <h3 className="font-bold text-lg md:text-xl truncate text-white">{chapterTitle}</h3>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium px-3 py-1 rounded-full bg-white/10 text-white/90">
            Page {currentPage + 1} / {pages.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-muted-foreground hover:text-white"
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Reader display */}
      <div className="flex flex-col items-center gap-6 py-2">
        <div
          className="relative max-w-4xl w-full flex justify-center cursor-pointer select-none group"
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
            className="max-h-[82vh] w-auto object-contain rounded-lg shadow-2xl border border-white/10"
            loading="eager"
          />

          {/* Hover indicator arrows */}
          <div className="absolute inset-y-0 left-0 w-1/4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-start pl-4 pointer-events-none">
            <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-sm">
              <ChevronLeft className="h-6 w-6" />
            </span>
          </div>
          <div className="absolute inset-y-0 right-0 w-1/4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pr-4 pointer-events-none">
            <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-sm">
              <ChevronRight className="h-6 w-6" />
            </span>
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full pt-2">
          {hasPrevChapter && onPrevChapter && (
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 hover:bg-white/10"
              onClick={onPrevChapter}
            >
              Chapitre précédent
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0 && !hasPrevChapter}
            className="border-white/20 hover:bg-white/10"
            onClick={handlePrevPage}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Précédente
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pages.length - 1 && !hasNextChapter}
            className="border-white/20 hover:bg-white/10"
            onClick={handleNextPage}
          >
            Suivante <ChevronRight className="h-4 w-4 ml-1" />
          </Button>

          {hasNextChapter && onNextChapter && (
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 hover:bg-white/10"
              onClick={onNextChapter}
            >
              Chapitre suivant
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Astuce : Utilisez les flèches gauche/droite du clavier ou cliquez sur les côtés de l&apos;image pour tourner les pages.
        </p>
      </div>
    </div>
  );
};

export default OriginMangaReader;

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSource } from '@/integrations/sources';

type Options = {
  pages: string[] | undefined;
  currentPage: number;
  preloadCount: number;
  sourceId: string;
  nextChapterId?: string;
};

export function getPreloadIndices(total: number, current: number, ahead: number): number[] {
  if (total <= 0) return [];
  const start = Math.max(0, current - 1);
  const end = Math.min(total - 1, current + Math.max(1, ahead));
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

export function useReaderPreloading({ pages, currentPage, preloadCount, sourceId, nextChapterId }: Options) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pages?.length) return;
    const images = getPreloadIndices(pages.length, currentPage, preloadCount).map((index) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = pages[index];
      return image;
    });
    return () => images.forEach((image) => {
      image.src = '';
    });
  }, [currentPage, pages, preloadCount]);

  useEffect(() => {
    if (!pages?.length || !nextChapterId) return;
    const threshold = Math.max(2, preloadCount);
    if (currentPage < pages.length - threshold) return;
    const source = getSource(sourceId);
    if (!source) return;
    let cancelled = false;

    queryClient.ensureQueryData({
      queryKey: ['reader', 'pages', sourceId, nextChapterId],
      queryFn: () => source.getPageUrls(nextChapterId),
      staleTime: 60 * 60 * 1000,
    }).then((nextPages) => {
      if (cancelled || nextPages.length === 0) return;
      const firstPage = new Image();
      firstPage.decoding = 'async';
      firstPage.src = nextPages[0];
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [currentPage, nextChapterId, pages, preloadCount, queryClient, sourceId]);
}

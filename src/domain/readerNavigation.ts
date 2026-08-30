export type ReaderPageDirection = 'previous' | 'next';

export type ReaderPageTransition = {
  pageIndex: number;
  progressPercent: number;
};

export function moveReaderPage(
  currentPage: number,
  totalPages: number,
  direction: ReaderPageDirection,
  step = 1,
): number {
  if (totalPages <= 0) return 0;
  const delta = direction === 'next' ? Math.max(1, step) : -Math.max(1, step);
  return Math.min(totalPages - 1, Math.max(0, currentPage + delta));
}

export function createReaderPageTransition(
  currentPage: number,
  totalPages: number,
  direction: ReaderPageDirection,
  step = 1,
): ReaderPageTransition {
  const pageIndex = moveReaderPage(currentPage, totalPages, direction, step);
  return {
    pageIndex,
    progressPercent: totalPages > 0
      ? Math.min(100, Math.round(((pageIndex + 1) / totalPages) * 100))
      : 0,
  };
}

export function withReaderPage(search: URLSearchParams, pageIndex: number): URLSearchParams {
  const next = new URLSearchParams(search);
  next.set('page', String(Math.max(0, Math.trunc(pageIndex))));
  return next;
}

export function shouldHydrateReaderPage(previousIdentity: string, nextIdentity: string): boolean {
  return previousIdentity !== nextIdentity;
}

export function buildReaderLocation(input: {
  source: string;
  mangaId: string;
  chapterId: string;
  language: string;
  pageIndex: number;
  mangaTitle?: string;
  mangaAuthor?: string | null;
}): string {
  const search = new URLSearchParams({
    lang: input.language,
    page: String(Math.max(0, Math.trunc(input.pageIndex))),
  });
  if (input.mangaTitle) search.set('title', input.mangaTitle);
  if (input.mangaAuthor) search.set('author', input.mangaAuthor);
  return `/read/${encodeURIComponent(input.source)}/${encodeURIComponent(input.mangaId)}/${encodeURIComponent(input.chapterId)}?${search}`;
}

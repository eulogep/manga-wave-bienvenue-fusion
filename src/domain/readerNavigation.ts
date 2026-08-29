export type ReaderPageDirection = 'previous' | 'next';

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

export function withReaderPage(search: URLSearchParams, pageIndex: number): URLSearchParams {
  const next = new URLSearchParams(search);
  next.set('page', String(Math.max(0, Math.trunc(pageIndex))));
  return next;
}

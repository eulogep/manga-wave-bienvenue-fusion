import { normalizeMangaTitle } from './canonicalManga.ts';

export type CanonicalProgressLike = {
  canonicalKey?: string;
  mangaTitle: string;
  readAt: string;
};

export function canonicalProgressKey(mangaTitle: string): string {
  const normalized = normalizeMangaTitle(mangaTitle);
  return `title:${normalized || 'unknown'}`;
}

export function buildCanonicalProgressSnapshot<
  T extends { canonicalKey?: string; mangaTitle: string; pageIndex?: number; totalPages?: number },
>(item: T, readAt = new Date().toISOString()): T & {
  canonicalKey: string;
  pageIndex: number;
  totalPages: number;
  readAt: string;
  progressPercent: number;
} {
  const pageIndex = Math.max(0, item.pageIndex || 0);
  const totalPages = Math.max(1, item.totalPages || 1);
  return {
    ...item,
    canonicalKey: item.canonicalKey || canonicalProgressKey(item.mangaTitle),
    pageIndex,
    totalPages,
    readAt,
    progressPercent: Math.min(100, Math.max(0, Math.round(((pageIndex + 1) / totalPages) * 100))),
  };
}

export function mergeCanonicalProgress<T extends CanonicalProgressLike>(items: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of items) {
    const key = item.canonicalKey || canonicalProgressKey(item.mangaTitle);
    const previous = merged.get(key);
    if (!previous || new Date(item.readAt).getTime() > new Date(previous.readAt).getTime()) {
      merged.set(key, { ...item, canonicalKey: key });
    }
  }
  return [...merged.values()].sort(
    (left, right) => new Date(right.readAt).getTime() - new Date(left.readAt).getTime(),
  );
}

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

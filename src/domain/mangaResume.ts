import { canonicalProgressKey } from './canonicalProgress.ts';

export type MangaResumeProgress = {
  canonicalKey?: string;
  canonicalMangaId?: number | null;
  mangaTitle: string;
  readAt: string;
};

export type MangaResumeIdentity = {
  canonicalMangaId?: number | null;
  title: string;
};

const newest = <T extends MangaResumeProgress>(items: T[]): T | null => (
  [...items].sort((left, right) => (
    new Date(right.readAt).getTime() - new Date(left.readAt).getTime()
  ))[0] || null
);

/**
 * Finds saved progress for a canonical work without confusing similarly named
 * provider records. A canonical id wins; normalized title is only the fallback
 * used by anonymous progress and older snapshots.
 */
export function findMangaResumeProgress<T extends MangaResumeProgress>(
  items: T[],
  identity: MangaResumeIdentity,
): T | null {
  if (identity.canonicalMangaId != null) {
    const canonicalMatches = items.filter(
      (item) => item.canonicalMangaId === identity.canonicalMangaId,
    );
    if (canonicalMatches.length > 0) return newest(canonicalMatches);
  }

  const expectedKey = canonicalProgressKey(identity.title);
  return newest(items.filter((item) => (
    (identity.canonicalMangaId == null
      || item.canonicalMangaId == null
      || item.canonicalMangaId === identity.canonicalMangaId)
    &&
    (item.canonicalKey || canonicalProgressKey(item.mangaTitle)) === expectedKey
  )));
}

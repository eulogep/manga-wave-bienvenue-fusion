import { normalizeLogicalChapterNumber } from './chapterMatching.ts';

export type FollowedChapterState = {
  mangaId: number;
  canonicalChapterKey: string;
  chapterNumber: string;
  chapterTitle: string | null;
  provider: string;
  providerMangaId: string;
  providerChapterId: string;
  language: string;
  firstSeenAt: string;
  readAt: string | null;
};

export type DetectedFollowedChapter = Omit<FollowedChapterState, 'firstSeenAt' | 'readAt'>;

const chapterValue = (chapterNumber: string): number => {
  const value = Number.parseFloat(normalizeLogicalChapterNumber(chapterNumber));
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
};

export function sortDetectedChapters(chapters: DetectedFollowedChapter[]): DetectedFollowedChapter[] {
  return [...chapters].sort((left, right) => (
    chapterValue(right.chapterNumber) - chapterValue(left.chapterNumber)
    || right.chapterNumber.localeCompare(left.chapterNumber)
  ));
}

export function dedupeDetectedChapters(chapters: DetectedFollowedChapter[]): DetectedFollowedChapter[] {
  const byLogicalChapter = new Map<string, DetectedFollowedChapter>();
  for (const chapter of sortDetectedChapters(chapters)) {
    if (!chapter.canonicalChapterKey || byLogicalChapter.has(chapter.canonicalChapterKey)) continue;
    byLogicalChapter.set(chapter.canonicalChapterKey, chapter);
  }
  return [...byLogicalChapter.values()];
}

export function reconcileFollowedChapters(
  detected: DetectedFollowedChapter[],
  existing: FollowedChapterState[],
  observedAt: string,
): { rowsToInsert: FollowedChapterState[]; unread: FollowedChapterState[]; isBaseline: boolean } {
  const canonicalDetected = dedupeDetectedChapters(detected);
  const existingByKey = new Map(existing.map((chapter) => [chapter.canonicalChapterKey, chapter]));
  const isBaseline = existing.length === 0;
  const rowsToInsert = canonicalDetected
    .filter((chapter) => !existingByKey.has(chapter.canonicalChapterKey))
    .map((chapter) => ({
      ...chapter,
      firstSeenAt: observedAt,
      readAt: isBaseline ? observedAt : null,
    }));
  const unread = [
    ...existing.filter((chapter) => chapter.readAt === null),
    ...rowsToInsert.filter((chapter) => chapter.readAt === null),
  ];
  return { rowsToInsert, unread: sortDetectedChapters(unread), isBaseline };
}

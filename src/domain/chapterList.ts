import { normalizeLogicalChapterNumber } from './chapterMatching.ts';

export type ChapterListItem = {
  id: string;
  chapterNumber: string;
  title?: string | null;
  date?: string | null;
  scanlationGroup?: string | null;
  scanlationGroups?: string[];
};

export type ChapterSort = 'desc' | 'asc';

const normalizeText = (value: string): string => value.normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLocaleLowerCase('fr')
  .replace(/[^\p{L}\p{N}.]+/gu, ' ')
  .trim();

export function filterChapters<T extends ChapterListItem>(chapters: T[], query: string): T[] {
  const wanted = normalizeText(query);
  if (!wanted) return chapters;
  return chapters.filter((chapter) => normalizeText([
    chapter.chapterNumber,
    chapter.title,
    chapter.scanlationGroup,
    ...(chapter.scanlationGroups || []),
  ].filter(Boolean).join(' ')).includes(wanted));
}

export function sortChapters<T extends ChapterListItem>(chapters: T[], direction: ChapterSort): T[] {
  return [...chapters].sort((left, right) => {
    const leftNumber = normalizeLogicalChapterNumber(left.chapterNumber);
    const rightNumber = normalizeLogicalChapterNumber(right.chapterNumber);
    if (leftNumber && rightNumber) {
      const difference = Number(leftNumber) - Number(rightNumber);
      if (difference) return direction === 'asc' ? difference : -difference;
    } else if (leftNumber) return -1;
    else if (rightNumber) return 1;

    const dateDifference = (Date.parse(right.date || '') || 0) - (Date.parse(left.date || '') || 0);
    if (dateDifference) return direction === 'desc' ? dateDifference : -dateDifference;
    return left.id.localeCompare(right.id);
  });
}

export function firstReadableChapter<T extends ChapterListItem>(chapters: T[]): T | null {
  return sortChapters(chapters, 'asc')[0] || null;
}

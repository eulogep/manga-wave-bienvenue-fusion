export type ChapterIdentity = {
  id: string;
  chapterNumber: string;
  language?: string;
};

export type ChapterMatch<TChapter extends ChapterIdentity> = {
  chapter: TChapter;
  canonicalChapterKey: string;
  confidence: number;
  reason: 'exact_number' | 'compatible_decimal';
};

/**
 * Accept only an explicit numeric chapter identity. Provider ordering, the first
 * result and generic defaults are intentionally never considered evidence.
 */
export function normalizeLogicalChapterNumber(value: string | null | undefined): string | null {
  const prepared = value
    ?.trim()
    .toLowerCase()
    .replace(',', '.')
    .replace(/^(?:chapter|chapitre|chap\.?|ch\.?)\s*/i, '');
  if (!prepared || !/^\d+(?:\.\d+)?$/.test(prepared)) return null;

  const [integerPart, decimalPart] = prepared.split('.');
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const normalizedDecimal = decimalPart?.replace(/0+$/, '') || '';
  return normalizedDecimal ? `${normalizedInteger}.${normalizedDecimal}` : normalizedInteger;
}

export function findEquivalentChapter<TChapter extends ChapterIdentity>(
  requestedChapterNumber: string | null | undefined,
  chapters: TChapter[],
): ChapterMatch<TChapter> | null {
  const requested = normalizeLogicalChapterNumber(requestedChapterNumber);
  if (!requested) return null;

  for (const chapter of chapters) {
    const candidate = normalizeLogicalChapterNumber(chapter.chapterNumber);
    if (!candidate || candidate !== requested) continue;
    return {
      chapter,
      canonicalChapterKey: requested,
      confidence: 1,
      reason: chapter.chapterNumber.trim() === requested ? 'exact_number' : 'compatible_decimal',
    };
  }

  return null;
}

export function getHighestLogicalChapterNumber(
  chapters: Array<Pick<ChapterIdentity, 'chapterNumber'>>,
): string | null {
  const valid = chapters.flatMap((chapter) => {
    const normalized = normalizeLogicalChapterNumber(chapter.chapterNumber);
    return normalized ? [{ normalized, numeric: Number(normalized) }] : [];
  });
  if (valid.length === 0) return null;
  valid.sort((left, right) => right.numeric - left.numeric || right.normalized.localeCompare(left.normalized));
  return valid[0].normalized;
}

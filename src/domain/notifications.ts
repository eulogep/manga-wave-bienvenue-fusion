import { findEquivalentChapter } from './chapterMatching.ts';
import { buildReaderLocation } from './readerNavigation.ts';
import type { SourceChapter } from '../integrations/sources/types.ts';

export type NotificationSourceCandidate = {
  sourceId: string;
  sourceMangaId: string;
  language: string;
  eligible: boolean;
};

export async function resolveNotificationReaderLocation(input: {
  canonicalChapterKey: string;
  mangaTitle: string;
  mangaAuthor?: string | null;
  candidates: NotificationSourceCandidate[];
  loadChapters: (candidate: NotificationSourceCandidate) => Promise<SourceChapter[]>;
}): Promise<string | null> {
  for (const candidate of input.candidates) {
    if (!candidate.eligible) continue;
    try {
      const chapters = await input.loadChapters(candidate);
      const match = findEquivalentChapter(input.canonicalChapterKey, chapters);
      if (!match) continue;
      return buildReaderLocation({
        source: candidate.sourceId,
        mangaId: candidate.sourceMangaId,
        chapterId: match.chapter.id,
        language: match.chapter.language || candidate.language || 'und',
        pageIndex: 0,
        mangaTitle: input.mangaTitle,
        mangaAuthor: input.mangaAuthor,
      });
    } catch {
      // Continue through the existing ranked candidates when a source fails.
    }
  }
  return null;
}

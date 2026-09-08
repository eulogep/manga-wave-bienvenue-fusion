import { resolveNotificationReaderLocation, type NotificationSourceCandidate } from './notifications.ts';
import type { SourceChapter } from '../integrations/sources/types.ts';

export type ReadingHistoryEntry = {
  id: number;
  user_id: string;
  canonical_manga_id: number;
  canonical_chapter_key: string;
  chapter_number: string;
  manga_title: string;
  manga_author: string | null;
  cover_image: string | null;
  page_index: number;
  total_pages: number;
  provider: string;
  provider_manga_id: string;
  provider_chapter_id: string;
  language: string;
  started_at: string;
  read_at: string;
  updated_at: string;
};

export type HistoryPeriod = 'all' | 'today' | '7' | '30';
export const HISTORY_PAGE_SIZE = 25;

export function historySince(period: HistoryPeriod, now = new Date()): string | null {
  if (period === 'all') return null;
  const date = new Date(now);
  if (period === 'today') date.setHours(0, 0, 0, 0);
  else date.setDate(date.getDate() - Number(period));
  return date.toISOString();
}

export function historySearchPattern(query: string): string {
  return `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`;
}

export async function resolveHistoryLocation(
  entry: ReadingHistoryEntry,
  candidates: NotificationSourceCandidate[],
  loadChapters: (candidate: NotificationSourceCandidate) => Promise<SourceChapter[]>,
): Promise<string | null> {
  // Reuse canonical matching and ranked fallback; never reopen by stored provider ID alone.
  const location = await resolveNotificationReaderLocation({
    canonicalChapterKey: entry.canonical_chapter_key,
    mangaTitle: entry.manga_title,
    mangaAuthor: entry.manga_author,
    candidates,
    loadChapters,
  });
  if (!location) return null;
  const url = new URL(location, 'https://history.invalid');
  url.searchParams.set('page', String(Math.max(0, entry.page_index)));
  return `${url.pathname}${url.search}`;
}

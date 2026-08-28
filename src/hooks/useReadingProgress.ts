import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type ReadingProgressItem = {
  source: string;
  mangaId: string;
  mangaTitle: string;
  mangaAuthor?: string | null;
  coverImage?: string | null;
  chapterId: string;
  chapterNumber: string;
  chapterTitle?: string | null;
  pageIndex: number;
  totalPages: number;
  readAt: string; // ISO date
  progressPercent: number;
};

const STORAGE_KEY = 'manga_wave_reading_history_v1';
const HISTORY_EVENT = 'manga_wave_history_updated';

/* ── LOCAL STORAGE HELPERS ── */
export function getLocalHistory(): ReadingProgressItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime());
  } catch {
    return [];
  }
}

export function saveLocalHistoryItem(item: Omit<ReadingProgressItem, 'readAt' | 'progressPercent'> & {
  pageIndex?: number;
  totalPages?: number;
}): ReadingProgressItem {
  const currentHistory = getLocalHistory();
  const now = new Date().toISOString();
  const pageIndex = item.pageIndex || 0;
  const totalPages = item.totalPages || 1;
  const progressPercent = Math.min(100, Math.max(0, Math.round(((pageIndex + 1) / totalPages) * 100)));

  const newItem: ReadingProgressItem = {
    ...item,
    pageIndex,
    totalPages,
    readAt: now,
    progressPercent,
  };

  // Deduplicate by source + mangaId: update existing and put at top
  const filtered = currentHistory.filter(
    (h) => !(h.source === item.source && String(h.mangaId) === String(item.mangaId)),
  );

  const updated = [newItem, ...filtered].slice(0, 50); // Keep last 50
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch (err) {
    console.warn('Could not save reading progress to localStorage:', err);
  }

  return newItem;
}

export function removeLocalHistoryItem(source: string, mangaId: string) {
  const currentHistory = getLocalHistory();
  const filtered = currentHistory.filter(
    (h) => !(h.source === source && String(h.mangaId) === String(mangaId)),
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch (err) {
    console.warn('Could not remove item from localStorage:', err);
  }
}

export function clearLocalHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch (err) {
    console.warn('Could not clear reading history:', err);
  }
}

/* ── REACT HOOKS ── */

/**
 * Hook to retrieve all recently read mangas (LocalStorage + Supabase sync)
 */
export const useContinueReading = () => {
  const { user } = useAuth();
  const [localItems, setLocalItems] = useState<ReadingProgressItem[]>(() => getLocalHistory());

  // Listen to custom local storage change events for real-time updates
  useEffect(() => {
    const handleUpdate = () => {
      setLocalItems(getLocalHistory());
    };
    window.addEventListener(HISTORY_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(HISTORY_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return useQuery({
    queryKey: ['continue-reading-universal', user?.id, localItems.length],
    queryFn: async (): Promise<ReadingProgressItem[]> => {
      const local = getLocalHistory();

      // If user is logged in, try to fetch remote history as well
      if (user) {
        try {
          const { data, error } = await supabase
            .from('user_history')
            .select('read_at, chapters(mangadex_id, chapter_number, title, pages_count, mangas(id, mangadex_id, title, author, cover_image))')
            .eq('user_id', user.id)
            .order('read_at', { ascending: false })
            .limit(20);

          if (!error && data) {
            const remoteItems: ReadingProgressItem[] = data.flatMap((h) => {
              const ch = h.chapters;
              const m = ch?.mangas;
              if (!ch?.mangadex_id || !m) return [];
              return [{
                source: 'mangadex',
                mangaId: m.mangadex_id || String(m.id),
                mangaTitle: m.title,
                mangaAuthor: m.author,
                coverImage: m.cover_image,
                chapterId: ch.mangadex_id,
                chapterNumber: String(ch.chapter_number || '1'),
                chapterTitle: ch.title,
                pageIndex: 0,
                totalPages: ch.pages_count || 1,
                readAt: h.read_at,
                progressPercent: 100,
              }];
            });

            // Merge local and remote, local has precedence for latest page
            const combinedMap = new Map<string, ReadingProgressItem>();
            for (const item of remoteItems) {
              combinedMap.set(`${item.source}:${item.mangaId}`, item);
            }
            for (const item of local) {
              combinedMap.set(`${item.source}:${item.mangaId}`, item);
            }
            return Array.from(combinedMap.values()).sort(
              (a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime(),
            );
          }
        } catch {
          // Fallback to local
        }
      }

      return local;
    },
    initialData: localItems,
    staleTime: 1000 * 10,
  });
};

/**
 * Hook to record reading progress for ANY source
 */
export const useRecordReading = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const recordReading = useMutation({
    mutationFn: async (item: Omit<ReadingProgressItem, 'readAt' | 'progressPercent'> & {
      pageIndex?: number;
      totalPages?: number;
    }) => {
      // 1. Always save to LocalStorage immediately
      const saved = saveLocalHistoryItem(item);

      // 2. If logged in and MangaDex, also sync with Supabase in background
      if (user && item.source === 'mangadex') {
        try {
          await supabase.functions.invoke('reading-progress', {
            body: {
              manga: { id: item.mangaId, title: item.mangaTitle },
              chapter: { id: item.chapterId, chapter: item.chapterNumber },
            },
          }).catch(() => {});
        } catch {
          // Ignore background sync errors
        }
      }

      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continue-reading-universal'] });
    },
  });

  return { recordReading };
};

/**
 * Hook to get last read chapter & page for a specific manga
 */
export function useMangaProgress(source: string, mangaId: string | undefined) {
  const { data: items = [] } = useContinueReading();
  if (!mangaId) return null;
  return items.find((i) => i.source === source && String(i.mangaId) === String(mangaId)) || null;
}

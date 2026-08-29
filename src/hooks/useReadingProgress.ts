import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { canonicalProgressKey, mergeCanonicalProgress } from '@/domain/canonicalProgress';
import { normalizeLogicalChapterNumber } from '@/domain/chapterMatching';

export type ReadingProgressItem = {
  canonicalKey?: string;
  canonicalMangaId?: number | null;
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
  language?: string;
};

const STORAGE_KEY = 'manga_wave_reading_history_v1';
const HISTORY_EVENT = 'manga_wave_history_updated';
type ReadingProgressInput = Omit<ReadingProgressItem, 'readAt' | 'progressPercent'> & {
  pageIndex?: number;
  totalPages?: number;
};

/* ── LOCAL STORAGE HELPERS ── */
export function getLocalHistory(): ReadingProgressItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return mergeCanonicalProgress(parsed.map((item: ReadingProgressItem) => ({
      ...item,
      canonicalKey: item.canonicalKey || canonicalProgressKey(item.mangaTitle),
    })));
  } catch {
    return [];
  }
}

export function saveLocalHistoryItem(item: ReadingProgressInput): ReadingProgressItem {
  const currentHistory = getLocalHistory();
  const now = new Date().toISOString();
  const pageIndex = item.pageIndex || 0;
  const totalPages = item.totalPages || 1;
  const progressPercent = Math.min(100, Math.max(0, Math.round(((pageIndex + 1) / totalPages) * 100)));
  const canonicalKey = item.canonicalKey || canonicalProgressKey(item.mangaTitle);

  const newItem: ReadingProgressItem = {
    ...item,
    canonicalKey,
    pageIndex,
    totalPages,
    readAt: now,
    progressPercent,
  };

  // Deduplicate by canonical work: switching provider updates one position.
  const filtered = currentHistory.filter(
    (historyItem) => (historyItem.canonicalKey || canonicalProgressKey(historyItem.mangaTitle)) !== canonicalKey,
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

export function removeLocalHistoryItem(canonicalKey: string) {
  const currentHistory = getLocalHistory();
  const filtered = currentHistory.filter(
    (historyItem) => (historyItem.canonicalKey || canonicalProgressKey(historyItem.mangaTitle)) !== canonicalKey,
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

export const useReadingHistoryActions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const remove = useCallback(async (canonicalKey: string) => {
    removeLocalHistoryItem(canonicalKey);
    if (user) {
      await supabase
        .from('user_canonical_reading_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('canonical_key', canonicalKey);
    }
    queryClient.invalidateQueries({ queryKey: ['continue-reading-universal'] });
  }, [queryClient, user]);

  const clear = useCallback(async () => {
    clearLocalHistory();
    if (user) {
      await supabase.from('user_canonical_reading_progress').delete().eq('user_id', user.id);
    }
    queryClient.invalidateQueries({ queryKey: ['continue-reading-universal'] });
  }, [queryClient, user]);

  return { clear, remove };
};

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
    queryKey: ['continue-reading-universal', user?.id, localItems.map((item) => item.readAt).join('|')],
    queryFn: async (): Promise<ReadingProgressItem[]> => {
      const local = getLocalHistory();

      // If user is logged in, try to fetch remote history as well
      if (user) {
        try {
          const { data, error } = await supabase
            .from('user_canonical_reading_progress')
            .select('*')
            .eq('user_id', user.id)
            .order('read_at', { ascending: false })
            .limit(50);

          if (!error && data) {
            const remoteItems: ReadingProgressItem[] = data.map((item) => ({
              canonicalKey: item.canonical_key,
              canonicalMangaId: item.canonical_manga_id,
              source: item.last_provider,
              mangaId: item.last_provider_manga_id,
              mangaTitle: item.manga_title,
              mangaAuthor: item.manga_author,
              coverImage: item.cover_image,
              chapterId: item.last_provider_chapter_id,
              chapterNumber: item.chapter_number,
              chapterTitle: item.chapter_title,
              pageIndex: item.page_index,
              totalPages: item.total_pages,
              readAt: item.read_at,
              progressPercent: item.progress_percentage,
              language: item.language,
            }));

            return mergeCanonicalProgress([...remoteItems, ...local]);
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
  const pendingRef = useRef<ReadingProgressInput | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const remoteTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const flushLocal = useCallback(() => {
    const item = pendingRef.current;
    if (!item) return;
    saveLocalHistoryItem(item);
    queryClient.invalidateQueries({ queryKey: ['continue-reading-universal'] });
  }, [queryClient]);

  const flushRemote = useCallback(async () => {
    const item = pendingRef.current;
    if (!item || !user) return;
    const totalPages = Math.max(1, item.totalPages || 1);
    const pageIndex = Math.max(0, item.pageIndex || 0);
    const canonicalKey = item.canonicalKey || canonicalProgressKey(item.mangaTitle);
    let canonicalMangaId = item.canonicalMangaId || null;
    if (!canonicalMangaId) {
      const { data: mapping } = await supabase
        .from('manga_source_mappings')
        .select('manga_id')
        .eq('source_id', item.source)
        .eq('source_manga_id', String(item.mangaId))
        .maybeSingle();
      canonicalMangaId = mapping?.manga_id || null;
    }
    await supabase.from('user_canonical_reading_progress').upsert({
      user_id: user.id,
      canonical_key: canonicalKey,
      canonical_manga_id: canonicalMangaId,
      canonical_chapter_key: normalizeLogicalChapterNumber(item.chapterNumber) || item.chapterNumber,
      last_provider: item.source,
      last_provider_manga_id: String(item.mangaId),
      last_provider_chapter_id: String(item.chapterId),
      language: item.language || 'und',
      manga_title: item.mangaTitle,
      manga_author: item.mangaAuthor || null,
      cover_image: item.coverImage || null,
      chapter_number: String(item.chapterNumber),
      chapter_title: item.chapterTitle || null,
      page_index: pageIndex,
      total_pages: totalPages,
      progress_percentage: Math.min(100, Math.round(((pageIndex + 1) / totalPages) * 100)),
      read_at: new Date().toISOString(),
    }, { onConflict: 'user_id,canonical_key' });
  }, [user]);

  const mutate = useCallback((item: ReadingProgressInput) => {
    pendingRef.current = item;
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
    localTimerRef.current = setTimeout(flushLocal, 500);
    remoteTimerRef.current = setTimeout(() => void flushRemote(), 2_000);
  }, [flushLocal, flushRemote]);

  useEffect(() => {
    const flush = () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      flushLocal();
      void flushRemote();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
      flush();
    };
  }, [flushLocal, flushRemote]);

  const recordReading = useMemo(() => ({ mutate }), [mutate]);

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

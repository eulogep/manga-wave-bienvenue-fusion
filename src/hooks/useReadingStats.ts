import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { computeReadingStats, WEEKLY_GOAL_OPTIONS, type ReadingSession } from '@/domain/readingStats';

export const STATS_WINDOW_DAYS = 365;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/** The signed-in reader's own sessions over the last 12 months (shared by stats and the feed). */
export function useReadingSessions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reading-stats', user?.id],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async (): Promise<ReadingSession[]> => {
      if (!user) return [];
      const since = new Date(Date.now() - STATS_WINDOW_DAYS * 86_400_000).toISOString();
      const rows: ReadingSession[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const { data, error } = await supabase
          .from('user_reading_history')
          .select('canonical_manga_id, canonical_chapter_key, page_index, total_pages, read_at')
          .eq('user_id', user.id)
          .gte('read_at', since)
          .order('read_at', { ascending: false })
          .order('id', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
      }
      return rows;
    },
  });
}

export function useReadingStats() {
  const { user } = useAuth();
  const catalog = useCanonicalSearch(Boolean(user));
  const sessions = useReadingSessions();

  const genresByManga = useMemo(
    () => new Map((catalog.data || []).map((work) => [work.id, work.genre])),
    [catalog.data],
  );
  const stats = useMemo(
    () => (sessions.data ? computeReadingStats(sessions.data, genresByManga) : null),
    [sessions.data, genresByManga],
  );

  return { stats, sessions, catalogPending: catalog.isPending };
}

const GOAL_STORAGE_KEY = 'mw-weekly-reading-goal';
const GOAL_EVENT = 'mw-weekly-reading-goal-changed';

function readGoal(): number | null {
  try {
    const value = Number(window.localStorage.getItem(GOAL_STORAGE_KEY));
    return (WEEKLY_GOAL_OPTIONS as readonly number[]).includes(value) ? value : null;
  } catch {
    return null;
  }
}

/** Weekly chapter goal, remembered on this device only. */
export function useWeeklyGoal() {
  const [goal, setGoalState] = useState(readGoal);

  useEffect(() => {
    const sync = () => setGoalState(readGoal());
    window.addEventListener(GOAL_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(GOAL_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setGoal = useCallback((next: number | null) => {
    try {
      if (next === null) window.localStorage.removeItem(GOAL_STORAGE_KEY);
      else window.localStorage.setItem(GOAL_STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable: the goal applies for this visit only.
    }
    setGoalState(next);
    window.dispatchEvent(new Event(GOAL_EVENT));
  }, []);

  return { goal, setGoal };
}

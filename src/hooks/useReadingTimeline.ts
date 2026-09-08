import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { getSource, isValidSource } from '@/integrations/sources';
import { HISTORY_PAGE_SIZE, historySearchPattern, historySince, resolveHistoryLocation, type HistoryPeriod, type ReadingHistoryEntry } from '@/domain/readingHistory';

export function useReadingTimeline(search: string, period: HistoryPeriod) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const since = historySince(period);
  const timeline = useInfiniteQuery({
    queryKey: ['reading-timeline', user?.id, search, period],
    enabled: Boolean(user),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ReadingHistoryEntry[]> => {
      if (!user) return [];
      let query = supabase.from('user_reading_history').select('*').eq('user_id', user.id)
        .order('read_at', { ascending: false }).order('id', { ascending: false })
        .range(pageParam, pageParam + HISTORY_PAGE_SIZE - 1);
      if (since) query = query.gte('read_at', since);
      if (search.trim()) query = query.ilike('manga_title', historySearchPattern(search));
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (last, pages) => last.length === HISTORY_PAGE_SIZE ? pages.length * HISTORY_PAGE_SIZE : undefined,
  });
  const remove = useMutation({
    mutationFn: async (id: number | null) => {
      if (!user) throw new Error('Authentification requise');
      let query = supabase.from('user_reading_history').delete().eq('user_id', user.id);
      if (id !== null) query = query.eq('id', id);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reading-timeline', user?.id] }),
  });
  const reopen = useMutation({
    mutationFn: async (entry: ReadingHistoryEntry) => {
      const { data, error } = await supabase.rpc('rank_canonical_manga_sources', {
        requested_canonical_id: entry.canonical_manga_id,
        preferred_language: entry.language,
      });
      if (error) throw error;
      const location = await resolveHistoryLocation(entry, data.map((candidate) => ({
        sourceId: candidate.source_id, sourceMangaId: candidate.source_manga_id,
        language: candidate.language, eligible: candidate.eligible && isValidSource(candidate.source_id),
      })), async (candidate) => {
        const source = getSource(candidate.sourceId);
        return source ? source.getChapters(candidate.sourceMangaId, { language: candidate.language, limit: 100 }) : [];
      });
      if (!location) throw new Error('Aucune source compatible ne propose ce chapitre pour le moment.');
      return location;
    },
  });
  return { ...timeline, entries: timeline.data?.pages.flat() || [], remove, reopen };
}

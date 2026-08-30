import { useQuery } from '@tanstack/react-query';
import { normalizeLogicalChapterNumber } from '@/domain/chapterMatching';
import {
  reconcileFollowedChapters,
  type DetectedFollowedChapter,
  type FollowedChapterState,
} from '@/domain/followedChapterUpdates';
import { getSource, isValidSource } from '@/integrations/sources';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFollows } from '@/hooks/useFollows';
import type { Manga } from '@/hooks/useManga';

type SourceMapping = {
  manga_id: number;
  source_id: string;
  source_manga_id: string;
  language: string;
  available: boolean;
};

export type FollowedMangaUpdate = {
  manga: Manga;
  newChapterCount: number;
  latestChapter: FollowedChapterState;
};

const languageRank = (language: string): number => {
  const normalized = language.toLowerCase().split(/[-_]/)[0];
  if (normalized === 'fr') return 0;
  if (normalized === 'multi') return 1;
  if (!normalized || normalized === 'und') return 2;
  return 3;
};

const toState = (row: {
  manga_id: number;
  canonical_chapter_key: string;
  chapter_number: string;
  chapter_title: string | null;
  provider: string;
  provider_manga_id: string;
  provider_chapter_id: string;
  language: string;
  first_seen_at: string;
  read_at: string | null;
}): FollowedChapterState => ({
  mangaId: row.manga_id,
  canonicalChapterKey: row.canonical_chapter_key,
  chapterNumber: row.chapter_number,
  chapterTitle: row.chapter_title,
  provider: row.provider,
  providerMangaId: row.provider_manga_id,
  providerChapterId: row.provider_chapter_id,
  language: row.language,
  firstSeenAt: row.first_seen_at,
  readAt: row.read_at,
});

export function useFollowedChapterUpdates() {
  const { user } = useAuth();
  const followsQuery = useFollows();
  const followedMangas = followsQuery.data?.flatMap((follow) => follow.manga ? [follow.manga] : []) || [];
  const mangaIds = followedMangas.map((manga) => manga.id);

  return useQuery({
    queryKey: ['followed-chapter-updates', user?.id, mangaIds.join(',')],
    enabled: Boolean(user && !followsQuery.isLoading && mangaIds.length > 0),
    queryFn: async (): Promise<FollowedMangaUpdate[]> => {
      if (!user || followedMangas.length === 0) return [];
      const [mappingsResult, stateResult] = await Promise.all([
        supabase
          .from('manga_source_mappings')
          .select('manga_id, source_id, source_manga_id, language, available')
          .in('manga_id', mangaIds)
          .eq('available', true),
        supabase
          .from('user_followed_chapter_state')
          .select('*')
          .eq('user_id', user.id)
          .in('manga_id', mangaIds),
      ]);
      if (mappingsResult.error) throw mappingsResult.error;
      if (stateResult.error) throw stateResult.error;

      const mappings = (mappingsResult.data || []) as SourceMapping[];
      const existing = (stateResult.data || []).map(toState);
      const observedAt = new Date().toISOString();
      const detectManga = async (manga: Manga) => {
        const candidates = mappings
          .filter((mapping) => mapping.manga_id === manga.id && isValidSource(mapping.source_id))
          .sort((left, right) => languageRank(left.language) - languageRank(right.language) || left.source_id.localeCompare(right.source_id));
        let detected: DetectedFollowedChapter[] = [];
        for (const mapping of candidates) {
          const adapter = getSource(mapping.source_id);
          if (!adapter) continue;
          try {
            const chapters = await adapter.getChapters(mapping.source_manga_id, { language: 'fr', limit: 100 });
            detected = chapters.flatMap((chapter) => {
              const canonicalChapterKey = normalizeLogicalChapterNumber(chapter.chapterNumber);
              if (!canonicalChapterKey) return [];
              return [{
                mangaId: manga.id,
                canonicalChapterKey,
                chapterNumber: chapter.chapterNumber,
                chapterTitle: chapter.title,
                provider: mapping.source_id,
                providerMangaId: mapping.source_manga_id,
                providerChapterId: chapter.id,
                language: chapter.language || mapping.language || 'und',
              }];
            }).slice(0, 20);
            if (detected.length > 0) break;
          } catch {
            // A failed mapping must not prevent another source from detecting updates.
          }
        }
        return {
          manga,
          reconciliation: reconcileFollowedChapters(
            detected,
            existing.filter((chapter) => chapter.mangaId === manga.id),
            observedAt,
          ),
        };
      };
      const reconciled: Awaited<ReturnType<typeof detectManga>>[] = [];
      for (let index = 0; index < followedMangas.length; index += 4) {
        const batch = followedMangas.slice(index, index + 4);
        reconciled.push(...await Promise.all(batch.map(detectManga)));
      }

      const rowsToInsert = reconciled.flatMap(({ reconciliation }) => reconciliation.rowsToInsert.map((chapter) => ({
        user_id: user.id,
        manga_id: chapter.mangaId,
        canonical_chapter_key: chapter.canonicalChapterKey,
        chapter_number: chapter.chapterNumber,
        chapter_title: chapter.chapterTitle,
        provider: chapter.provider,
        provider_manga_id: chapter.providerMangaId,
        provider_chapter_id: chapter.providerChapterId,
        language: chapter.language,
        first_seen_at: chapter.firstSeenAt,
        read_at: chapter.readAt,
      })));
      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('user_followed_chapter_state').insert(rowsToInsert);
        if (error) throw error;
      }

      return reconciled.flatMap(({ manga, reconciliation }) => {
        const latestChapter = reconciliation.unread[0];
        return latestChapter
          ? [{ manga, latestChapter, newChapterCount: reconciliation.unread.length }]
          : [];
      });
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

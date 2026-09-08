import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useFollowedChapterUpdates } from './useFollowedChapterUpdates';
import { useFollows } from './useFollows';
import { aggregateLibraryItems, type LibraryItem } from '@/domain/libraryItem';
import type { Manga } from './useManga';

export const libraryItemsQueryKey = (userId?: string) => ['library-items', userId] as const;

type FavoriteRow = {
  id: number;
  created_at: string;
  mangas: Manga | null;
};

type ProgressRow = {
  canonical_manga_id: number | null;
  canonical_key: string;
  manga_title: string;
  manga_author: string | null;
  cover_image: string | null;
  chapter_number: string;
  progress_percentage: number;
  read_at: string;
  last_provider: string;
  last_provider_manga_id: string;
  last_provider_chapter_id: string;
  language: string;
  page_index: number;
};

/**
 * Reads the canonical library signals from Supabase (favorites, follows, canonical
 * progress and follow-derived unread updates) and aggregates them into one
 * LibraryItem per canonical manga. This is the single source Library V2 renders
 * from — no per-provider queries happen here.
 */
export function useLibraryItems() {
  const { user } = useAuth();
  const followsQuery = useFollows();
  const updatesQuery = useFollowedChapterUpdates();

  const favoritesQuery = useQuery({
    queryKey: ['favorites-detailed', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<FavoriteRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_favorites')
        .select('id, created_at, mangas(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FavoriteRow[];
    },
  });

  const progressQuery = useQuery({
    queryKey: ['canonical-progress-detailed', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<ProgressRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_canonical_reading_progress')
        .select('canonical_manga_id, canonical_key, manga_title, manga_author, cover_image, chapter_number, progress_percentage, read_at, last_provider, last_provider_manga_id, last_provider_chapter_id, language, page_index')
        .eq('user_id', user.id)
        .order('read_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as ProgressRow[];
    },
  });

  const isLoading = Boolean(user) && (favoritesQuery.isLoading || followsQuery.isLoading || progressQuery.isLoading);
  const isError = favoritesQuery.isError || followsQuery.isError || progressQuery.isError;
  const error = favoritesQuery.error || followsQuery.error || progressQuery.error;

  const data: LibraryItem[] = user
    ? aggregateLibraryItems({
      favorites: (favoritesQuery.data || []).flatMap((favorite) => (favorite.mangas ? [{
        canonicalMangaId: favorite.mangas.id,
        title: favorite.mangas.title,
        author: favorite.mangas.author,
        cover: favorite.mangas.cover_image,
        genre: favorite.mangas.genre,
        status: favorite.mangas.status,
        favoritedAt: favorite.created_at,
      }] : [])),
      follows: (followsQuery.data || []).flatMap((follow) => (follow.manga ? [{
        canonicalMangaId: follow.canonicalMangaId,
        title: follow.manga.title,
        author: follow.manga.author,
        cover: follow.manga.cover_image,
        genre: follow.manga.genre,
        status: follow.manga.status,
        followedAt: follow.createdAt,
      }] : [])),
      progress: (progressQuery.data || []).map((row) => ({
        canonicalMangaId: row.canonical_manga_id,
        canonicalKey: row.canonical_key,
        title: row.manga_title,
        author: row.manga_author,
        cover: row.cover_image,
        chapterNumber: row.chapter_number,
        progressPercent: row.progress_percentage,
        readAt: row.read_at,
        source: row.last_provider,
        providerMangaId: row.last_provider_manga_id,
        chapterId: row.last_provider_chapter_id,
        language: row.language,
        pageIndex: row.page_index,
      })),
      updates: (updatesQuery.data || []).map((update) => ({
        canonicalMangaId: update.manga.id,
        title: update.manga.title,
        author: update.manga.author,
        cover: update.manga.cover_image,
        genre: update.manga.genre,
        status: update.manga.status,
        chapterNumber: update.latestChapter.chapterNumber,
        provider: update.latestChapter.provider,
        providerMangaId: update.latestChapter.providerMangaId,
        providerChapterId: update.latestChapter.providerChapterId,
        language: update.latestChapter.language,
        firstSeenAt: update.latestChapter.firstSeenAt,
        unreadCount: update.newChapterCount,
      })),
    })
    : [];

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => Promise.all([favoritesQuery.refetch(), followsQuery.refetch(), progressQuery.refetch(), updatesQuery.refetch()]),
    isFetching: favoritesQuery.isFetching || followsQuery.isFetching || progressQuery.isFetching || updatesQuery.isFetching,
  };
}

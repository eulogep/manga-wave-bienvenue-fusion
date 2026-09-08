import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveNotificationReaderLocation } from '@/domain/notifications';
import { getSource, isValidSource } from '@/integrations/sources';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type UserNotification = {
  id: number;
  canonicalMangaId: number;
  canonicalChapterKey: string;
  chapterNumber: string;
  chapterTitle: string | null;
  type: string;
  title: string;
  body: string;
  language: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  manga: {
    title: string;
    author: string | null;
    coverImage: string | null;
  };
};

type NotificationRow = {
  id: number;
  canonical_manga_id: number;
  canonical_chapter_key: string;
  chapter_number: string;
  chapter_title: string | null;
  type: string;
  title: string;
  body: string;
  language: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  manga: { title: string; author: string | null; cover_image: string | null } | null;
};

const notificationKey = (userId?: string) => ['notifications', userId] as const;

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: notificationKey(user?.id),
    enabled: Boolean(user),
    queryFn: async (): Promise<UserNotification[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_notifications')
        .select('id, canonical_manga_id, canonical_chapter_key, chapter_number, chapter_title, type, title, body, language, is_read, created_at, read_at, manga:mangas(title, author, cover_image)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data || []) as NotificationRow[]).map((row) => ({
        id: row.id,
        canonicalMangaId: row.canonical_manga_id,
        canonicalChapterKey: row.canonical_chapter_key,
        chapterNumber: row.chapter_number,
        chapterTitle: row.chapter_title,
        type: row.type,
        title: row.title,
        body: row.body,
        language: row.language,
        isRead: row.is_read,
        createdAt: row.created_at,
        readAt: row.read_at,
        manga: {
          title: row.manga?.title || 'Manga',
          author: row.manga?.author || null,
          coverImage: row.manga?.cover_image || null,
        },
      }));
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: async (notificationId: number) => {
      if (!user) throw new Error('Authentification requise');
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: readAt })
        .eq('id', notificationId)
        .eq('user_id', user.id);
      if (error) throw error;
      return { notificationId, readAt };
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationKey(user?.id) });
      const previous = queryClient.getQueryData<UserNotification[]>(notificationKey(user?.id));
      const readAt = new Date().toISOString();
      queryClient.setQueryData<UserNotification[]>(notificationKey(user?.id), (current = []) => (
        current.map((item) => item.id === notificationId ? { ...item, isRead: true, readAt } : item)
      ));
      return { previous };
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previous) queryClient.setQueryData(notificationKey(user?.id), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKey(user?.id) }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Authentification requise');
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKey(user?.id) }),
  });

  const resolveDestination = async (notification: UserNotification): Promise<string> => {
    const { data, error } = await supabase.rpc('rank_canonical_manga_sources', {
      requested_canonical_id: notification.canonicalMangaId,
      preferred_language: notification.language || 'fr',
    });
    if (error) throw error;
    const candidates = data.map((candidate) => ({
      sourceId: candidate.source_id,
      sourceMangaId: candidate.source_manga_id,
      language: candidate.language,
      eligible: candidate.eligible && isValidSource(candidate.source_id),
    }));
    const location = await resolveNotificationReaderLocation({
      canonicalChapterKey: notification.canonicalChapterKey,
      mangaTitle: notification.manga.title,
      mangaAuthor: notification.manga.author,
      candidates,
      loadChapters: async (candidate) => {
        const source = getSource(candidate.sourceId);
        if (!source) return [];
        return source.getChapters(candidate.sourceMangaId, {
          language: candidate.language,
          limit: 100,
        });
      },
    });
    if (!location) throw new Error('Aucune source compatible ne propose encore ce chapitre.');
    return location;
  };

  const notifications = notificationsQuery.data || [];
  return {
    ...notificationsQuery,
    notifications,
    unreadCount: notifications.filter((item) => !item.isRead).length,
    markRead,
    markAllRead,
    resolveDestination,
  };
}

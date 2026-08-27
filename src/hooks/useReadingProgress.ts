import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MangaDexChapter, MangaDexManga } from '@/integrations/mangadex/client';
import { useAuth } from './useAuth';

export type ContinueReadingItem = {
  mangaId: number;
  mangaDexId: string | null;
  mangaTitle: string;
  mangaAuthor: string | null;
  coverImage: string | null;
  chapterId: string;
  chapterLabel: string;
  chapterTitle: string | null;
  pageCount: number | null;
  readAt: string;
};

type HistoryRow = {
  read_at: string;
  chapters: {
    mangadex_id: string | null;
    chapter_number: number;
    title: string | null;
    pages_count: number | null;
    mangas: {
      id: number;
      mangadex_id: string | null;
      title: string;
      author: string | null;
      cover_image: string | null;
    } | null;
  } | null;
};

export const useContinueReading = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['continue-reading', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<ContinueReadingItem[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_history')
        .select('read_at, chapters(mangadex_id, chapter_number, title, pages_count, mangas(id, mangadex_id, title, author, cover_image))')
        .eq('user_id', user.id)
        .order('read_at', { ascending: false })
        .limit(24);

      if (error) throw error;

      const seenMangaIds = new Set<number>();
      return ((data || []) as unknown as HistoryRow[]).flatMap((history) => {
        const chapter = history.chapters;
        const manga = chapter?.mangas;
        if (!chapter?.mangadex_id || !manga || seenMangaIds.has(manga.id)) return [];
        seenMangaIds.add(manga.id);
        return [{
          mangaId: manga.id,
          mangaDexId: manga.mangadex_id,
          mangaTitle: manga.title,
          mangaAuthor: manga.author,
          coverImage: manga.cover_image,
          chapterId: chapter.mangadex_id,
          chapterLabel: chapter.chapter_number > 0 ? `Chapitre ${chapter.chapter_number}` : 'Chapitre spécial',
          chapterTitle: chapter.title,
          pageCount: chapter.pages_count,
          readAt: history.read_at,
        }];
      });
    },
  });
};

export const useRecordReading = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const recordReading = useMutation({
    mutationFn: async ({ manga, chapter }: { manga: MangaDexManga; chapter: MangaDexChapter }) => {
      if (!user) throw new Error('Connexion requise');

      const { error } = await supabase.functions.invoke('reading-progress', {
        body: { manga, chapter },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continue-reading', user?.id] });
    },
  });

  return { recordReading };
};

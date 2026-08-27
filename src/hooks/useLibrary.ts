import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Manga } from './useManga';

export type LibraryManga = Manga & {
  favoriteId: number;
  favoritedAt: string;
};

type FavoriteWithManga = {
  id: number;
  created_at: string;
  mangas: Manga | null;
};

/**
 * Retourne la bibliothèque personnelle du compte connecté. La sélection
 * s'appuie sur user_favorites, dont les politiques RLS limitent les lignes
 * à auth.uid().
 */
export const useLibrary = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['library', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<LibraryManga[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_favorites')
        .select('id, created_at, mangas(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return ((data || []) as unknown as FavoriteWithManga[])
        .flatMap((favorite) =>
          favorite.mangas
            ? [{
                ...favorite.mangas,
                favoriteId: favorite.id,
                favoritedAt: favorite.created_at,
              }]
            : [],
        );
    },
  });
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Manga {
  id: number;
  mangadex_id: string | null;
  title: string;
  author: string | null;
  artist: string | null;
  description: string | null;
  cover_image: string | null;
  rating: number | null;
  views: number;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  genre: string[];
  manga_type: string | null;
  content_rating: string | null;
  source_updated_at: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export const useManga = () => {
  const { user } = useAuth();

  const catalogQuery = useQuery({
    queryKey: ['mangas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mangas')
        .select('*')
        .order('source_updated_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as Manga[];
    },
  });

  const favoritesQuery = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_favorites')
        .select('manga_id')
        .eq('user_id', user.id);

      if (error) throw error;
      return data.map((favorite) => favorite.manga_id);
    },
    enabled: !!user,
  });

  return {
    mangas: catalogQuery.data || [],
    favorites: favoritesQuery.data || [],
    isLoading: catalogQuery.isLoading,
    isError: catalogQuery.isError,
    error: catalogQuery.error,
    refetch: catalogQuery.refetch,
    isFetching: catalogQuery.isFetching,
  };
};

export const useFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const toggleFavorite = useMutation({
    mutationFn: async (mangaId: number) => {
      if (!user) throw new Error('User not authenticated');

      const { data: existing, error: existingError } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('manga_id', mangaId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('manga_id', mangaId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: user.id, manga_id: mangaId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });

  return { toggleFavorite };
};

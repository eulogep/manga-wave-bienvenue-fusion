import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { normalizeWorkMetadata } from '@/domain/genres';

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

// Home rails never show synopses or artists; skipping them keeps the payload
// small as the catalogue grows (description is most of each row). Those two
// fields are therefore null in the rows returned by useManga.
const HOME_CATALOG_COLUMNS = 'id, mangadex_id, title, author, cover_image, rating, views, status, genre, manga_type, content_rating, source_updated_at, last_synced_at, created_at';

export const useManga = () => {
  const { user } = useAuth();

  const catalogQuery = useQuery({
    queryKey: ['mangas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mangas')
        .select(HOME_CATALOG_COLUMNS)
        .order('source_updated_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data as Omit<Manga, 'description' | 'artist'>[]).map((row) => normalizeWorkMetadata({ ...row, description: null, artist: null }));
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
      queryClient.invalidateQueries({ queryKey: ['library', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['favorites-detailed', user?.id] });
    },
  });

  return { toggleFavorite };
};

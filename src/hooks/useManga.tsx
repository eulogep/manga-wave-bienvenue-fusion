
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Manga {
  id: number;
  title: string;
  author: string;
  description: string;
  cover_image: string;
  rating: number;
  views: number;
  status: string;
  genre: string[];
  manga_type: string;
  created_at: string;
}

export const useManga = () => {
  const { user } = useAuth();

  const { data: mangas, isLoading } = useQuery({
    queryKey: ['mangas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mangas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Manga[];
    }
  });

  const { data: favorites } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_favorites')
        .select('manga_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data.map(f => f.manga_id);
    },
    enabled: !!user
  });

  return {
    mangas: mangas || [],
    favorites: favorites || [],
    isLoading
  };
};

export const useFavorites = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const toggleFavorite = useMutation({
    mutationFn: async (mangaId: number) => {
      if (!user) throw new Error('User not authenticated');

      const { data: existing } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('manga_id', mangaId)
        .single();

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
    }
  });

  return { toggleFavorite };
};

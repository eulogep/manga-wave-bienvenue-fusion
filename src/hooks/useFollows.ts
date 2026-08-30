import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Manga } from '@/hooks/useManga';
import { isCanonicalMangaFollowed } from '@/domain/canonicalFollow';

export type CanonicalFollow = {
  id: number;
  userId: string;
  canonicalMangaId: number;
  createdAt: string;
  updatedAt: string;
  manga: Manga | null;
};

type FollowRow = {
  id: number;
  user_id: string;
  canonical_manga_id: number;
  created_at: string;
  updated_at: string;
  mangas: Manga | null;
};

const toFollow = (row: FollowRow): CanonicalFollow => ({
  id: row.id,
  userId: row.user_id,
  canonicalMangaId: row.canonical_manga_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  manga: row.mangas,
});

export const followQueryKey = (userId?: string) => ['canonical-follows', userId] as const;

export function useFollows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: followQueryKey(user?.id),
    enabled: Boolean(user),
    queryFn: async (): Promise<CanonicalFollow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_follows')
        .select('id, user_id, canonical_manga_id, created_at, updated_at, mangas(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown as FollowRow[]).map(toFollow);
    },
    staleTime: 30_000,
  });
}

export function useCanonicalFollow(canonicalMangaId?: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const followsQuery = useFollows();
  const isFollowing = isCanonicalMangaFollowed(
    followsQuery.data?.map((follow) => follow.canonicalMangaId) || [],
    canonicalMangaId,
  );
  const mutation = useMutation({
    mutationFn: async (nextFollowing: boolean) => {
      if (!user || !canonicalMangaId) throw new Error('Authentication ou manga canonique absent');
      if (nextFollowing) {
        const { error } = await supabase.from('user_follows').upsert({
          user_id: user.id,
          canonical_manga_id: canonicalMangaId,
        }, { onConflict: 'user_id,canonical_manga_id', ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('canonical_manga_id', canonicalMangaId);
        if (error) throw error;
      }
      return nextFollowing;
    },
    onMutate: async (nextFollowing) => {
      if (!user || !canonicalMangaId) return undefined;
      const key = followQueryKey(user.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CanonicalFollow[]>(key);
      queryClient.setQueryData<CanonicalFollow[]>(key, (current = []) => (
        nextFollowing
          ? current.some((follow) => follow.canonicalMangaId === canonicalMangaId)
            ? current
            : [{
                id: -Date.now(),
                userId: user.id,
                canonicalMangaId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                manga: null,
              }, ...current]
          : current.filter((follow) => follow.canonicalMangaId !== canonicalMangaId)
      ));
      return { previous };
    },
    onError: (_error, _nextFollowing, context) => {
      if (user && context?.previous) {
        queryClient.setQueryData(followQueryKey(user.id), context.previous);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: followQueryKey(user?.id) }),
        queryClient.invalidateQueries({ queryKey: ['followed-chapter-updates'] }),
      ]);
    },
  });

  return {
    ...followsQuery,
    isFollowing,
    setFollowing: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}

export function useCanonicalMangaId(
  canonicalMangaId: number | undefined,
  sourceId: string | undefined,
  sourceMangaId: string | undefined,
) {
  return useQuery({
    queryKey: ['canonical-follow-identity', canonicalMangaId, sourceId, sourceMangaId],
    enabled: canonicalMangaId === undefined && Boolean(sourceId && sourceMangaId),
    queryFn: async (): Promise<number | undefined> => {
      if (canonicalMangaId !== undefined) return canonicalMangaId;
      if (!sourceId || !sourceMangaId) return undefined;
      const { data, error } = await supabase
        .from('manga_source_mappings')
        .select('manga_id')
        .eq('source_id', sourceId)
        .eq('source_manga_id', sourceMangaId)
        .maybeSingle();
      if (error) throw error;
      return data?.manga_id;
    },
    initialData: canonicalMangaId,
    staleTime: 5 * 60_000,
  });
}

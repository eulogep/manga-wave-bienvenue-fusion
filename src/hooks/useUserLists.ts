import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Manga } from '@/hooks/useManga';
import {
  applyListOrder,
  nextCustomListPosition,
  normalizeListNote,
  sortUserLists,
  type UserList,
  type UserListItem,
  type UserListKind,
} from '@/domain/userLists';

export type UserListItemWithManga = UserListItem & {
  manga: Pick<Manga, 'id' | 'title' | 'author' | 'cover_image' | 'status' | 'content_rating'> | null;
};

type ListRow = { id: number; name: string; kind: string; position: number; created_at: string };
type ItemRow = {
  id: number;
  list_id: number;
  canonical_manga_id: number;
  position: number;
  note: string | null;
  created_at: string;
  mangas: UserListItemWithManga['manga'];
};

const toList = (row: ListRow): UserList => ({
  id: row.id,
  name: row.name,
  kind: row.kind as UserListKind,
  position: row.position,
  createdAt: row.created_at,
});

const toItem = (row: ItemRow): UserListItemWithManga => ({
  id: row.id,
  listId: row.list_id,
  canonicalMangaId: row.canonical_manga_id,
  position: row.position,
  note: row.note,
  createdAt: row.created_at,
  manga: row.mangas,
});

export const userListsQueryKey = (userId?: string) => ['user-lists', userId] as const;
export const userListItemsQueryKey = (userId?: string) => ['user-list-items', userId] as const;

export function useUserLists() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const listsKey = userListsQueryKey(user?.id);
  const itemsKey = userListItemsQueryKey(user?.id);

  const listsQuery = useQuery({
    queryKey: listsKey,
    enabled: Boolean(user),
    queryFn: async (): Promise<UserList[]> => {
      // Creates the three system lists on first use, then returns every list of the user.
      const { data, error } = await supabase.rpc('ensure_default_user_lists');
      if (error) throw error;
      return sortUserLists(((data || []) as ListRow[]).map(toList));
    },
    staleTime: 60_000,
  });

  const itemsQuery = useQuery({
    queryKey: itemsKey,
    enabled: Boolean(user),
    queryFn: async (): Promise<UserListItemWithManga[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_list_items')
        .select('id, list_id, canonical_manga_id, position, note, created_at, mangas(id, title, author, cover_image, status, content_rating)')
        .eq('user_id', user.id);
      if (error) throw error;
      return ((data || []) as unknown as ItemRow[]).map(toItem);
    },
    staleTime: 30_000,
  });

  const requireUser = () => {
    if (!user) throw new Error('Connecte-toi pour gérer tes listes.');
    return user;
  };

  const invalidateAll = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: listsKey }),
    queryClient.invalidateQueries({ queryKey: itemsKey }),
  ]);

  const createList = useMutation({
    mutationFn: async (name: string) => {
      const owner = requireUser();
      const { data, error } = await supabase
        .from('user_lists')
        .insert({ user_id: owner.id, name, kind: 'custom', position: nextCustomListPosition(listsQuery.data || []) })
        .select('id, name, kind, position, created_at')
        .single();
      if (error) throw error;
      return toList(data as ListRow);
    },
    onSuccess: (list) => {
      queryClient.setQueryData<UserList[]>(listsKey, (current = []) => sortUserLists([...current, list]));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  });

  const renameList = useMutation({
    mutationFn: async ({ listId, name }: { listId: number; name: string }) => {
      requireUser();
      const { error } = await supabase.from('user_lists').update({ name }).eq('id', listId);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listsKey }),
  });

  const deleteList = useMutation({
    mutationFn: async (listId: number) => {
      requireUser();
      const { error } = await supabase.from('user_lists').delete().eq('id', listId).eq('kind', 'custom');
      if (error) throw error;
    },
    onSettled: invalidateAll,
  });

  const setMembership = useMutation({
    mutationFn: async ({ listId, canonicalMangaId, member }: { listId: number; canonicalMangaId: number; member: boolean }) => {
      const owner = requireUser();
      if (member) {
        const { error } = await supabase.from('user_list_items').upsert(
          { user_id: owner.id, list_id: listId, canonical_manga_id: canonicalMangaId },
          { onConflict: 'list_id,canonical_manga_id', ignoreDuplicates: true },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_list_items')
          .delete()
          .eq('list_id', listId)
          .eq('canonical_manga_id', canonicalMangaId);
        if (error) throw error;
      }
    },
    onMutate: async ({ listId, canonicalMangaId, member }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey });
      const previous = queryClient.getQueryData<UserListItemWithManga[]>(itemsKey);
      queryClient.setQueryData<UserListItemWithManga[]>(itemsKey, (current = []) => {
        const exists = current.some((item) => item.listId === listId && item.canonicalMangaId === canonicalMangaId);
        if (member) {
          return exists ? current : [...current, {
            id: -Date.now(),
            listId,
            canonicalMangaId,
            position: Number.MAX_SAFE_INTEGER,
            note: null,
            createdAt: new Date().toISOString(),
            manga: null,
          }];
        }
        return current.filter((item) => !(item.listId === listId && item.canonicalMangaId === canonicalMangaId));
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(itemsKey, context.previous ?? []);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemsKey }),
  });

  const updateNote = useMutation({
    mutationFn: async ({ itemId, note }: { itemId: number; note: string | null }) => {
      requireUser();
      const { error } = await supabase.from('user_list_items').update({ note: normalizeListNote(note) }).eq('id', itemId);
      if (error) throw error;
    },
    onMutate: async ({ itemId, note }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey });
      const previous = queryClient.getQueryData<UserListItemWithManga[]>(itemsKey);
      queryClient.setQueryData<UserListItemWithManga[]>(itemsKey, (current = []) => (
        current.map((item) => (item.id === itemId ? { ...item, note: normalizeListNote(note) } : item))
      ));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(itemsKey, context.previous ?? []);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemsKey }),
  });

  const reorderItems = useMutation({
    mutationFn: async ({ listId, orderedIds }: { listId: number; orderedIds: number[] }) => {
      requireUser();
      const { error } = await supabase.rpc('reorder_user_list_items', { p_list_id: listId, p_item_ids: orderedIds });
      if (error) throw error;
    },
    onMutate: async ({ orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: itemsKey });
      const previous = queryClient.getQueryData<UserListItemWithManga[]>(itemsKey);
      queryClient.setQueryData<UserListItemWithManga[]>(itemsKey, (current = []) => (
        applyListOrder(current, orderedIds)
      ));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(itemsKey, context.previous ?? []);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemsKey }),
  });

  return {
    lists: listsQuery.data || [],
    items: itemsQuery.data || [],
    isLoading: listsQuery.isLoading || itemsQuery.isLoading,
    isError: listsQuery.isError || itemsQuery.isError,
    error: listsQuery.error || itemsQuery.error,
    refetch: () => Promise.all([listsQuery.refetch(), itemsQuery.refetch()]),
    createList,
    renameList,
    deleteList,
    setMembership,
    updateNote,
    reorderItems,
  };
}

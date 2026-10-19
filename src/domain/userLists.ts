export type UserListKind = 'to_read' | 'on_hold' | 'completed' | 'custom';

export type UserList = {
  id: number;
  name: string;
  kind: UserListKind;
  position: number;
  createdAt: string;
};

export type UserListItem = {
  id: number;
  listId: number;
  canonicalMangaId: number;
  position: number;
  note: string | null;
  createdAt: string;
};

export const MAX_LIST_NAME_LENGTH = 60;
export const MAX_LIST_NOTE_LENGTH = 500;
export const MAX_CUSTOM_LISTS = 30;

export const SYSTEM_LIST_KINDS: readonly UserListKind[] = ['to_read', 'on_hold', 'completed'];

export const isSystemList = (list: Pick<UserList, 'kind'>): boolean => list.kind !== 'custom';

export const normalizeListName = (value: string): string => value.replace(/\s+/g, ' ').trim();

export type ListNameValidation = { ok: boolean; name: string; error: string | null };

/** Mirrors the database rules: 1–60 characters, unique per user regardless of case. */
export function validateListName(
  value: string,
  existing: Pick<UserList, 'id' | 'name'>[],
  ignoreListId?: number,
): ListNameValidation {
  const name = normalizeListName(value);
  if (!name) return { ok: false, name, error: 'Donne un nom à ta liste.' };
  if (name.length > MAX_LIST_NAME_LENGTH) {
    return { ok: false, name, error: `Le nom est limité à ${MAX_LIST_NAME_LENGTH} caractères.` };
  }
  const key = name.toLocaleLowerCase('fr');
  if (existing.some((list) => list.id !== ignoreListId && normalizeListName(list.name).toLocaleLowerCase('fr') === key)) {
    return { ok: false, name, error: 'Tu as déjà une liste avec ce nom.' };
  }
  return { ok: true, name, error: null };
}

/** Trims a private note; an empty note is stored as null. */
export function normalizeListNote(value: string | null | undefined): string | null {
  const note = (value || '').trim();
  if (!note) return null;
  return note.slice(0, MAX_LIST_NOTE_LENGTH);
}

/** System lists first in their fixed order, then custom lists by position and creation. */
export function sortUserLists(lists: UserList[]): UserList[] {
  const rank = (list: UserList) => {
    const systemIndex = SYSTEM_LIST_KINDS.indexOf(list.kind);
    return systemIndex === -1 ? SYSTEM_LIST_KINDS.length : systemIndex;
  };
  return [...lists].sort((left, right) => (
    rank(left) - rank(right) || left.position - right.position || left.id - right.id
  ));
}

export function sortListItems<T extends UserListItem>(items: T[]): T[] {
  return [...items].sort((left, right) => left.position - right.position || left.id - right.id);
}

export function nextCustomListPosition(lists: UserList[]): number {
  return lists.reduce((max, list) => Math.max(max, list.position), SYSTEM_LIST_KINDS.length - 1) + 1;
}

/**
 * Moves one item up or down within its list and returns the new ordered ids.
 * Returns null when the move is impossible (unknown item or already at the edge).
 */
export function moveListItem(
  items: UserListItem[],
  itemId: number,
  direction: 'up' | 'down',
): number[] | null {
  const ordered = sortListItems(items).map((item) => item.id);
  const index = ordered.indexOf(itemId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ordered.length) return null;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered;
}

/** Applies an ordered id array to items, so the cache can be updated optimistically. */
export function applyListOrder<T extends UserListItem>(items: T[], orderedIds: number[]): T[] {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return items.map((item) => (positions.has(item.id) ? { ...item, position: positions.get(item.id) as number } : item));
}

/** Ids of the lists that contain a canonical manga. */
export function listIdsContainingManga(items: UserListItem[], canonicalMangaId: number | null | undefined): Set<number> {
  if (canonicalMangaId === null || canonicalMangaId === undefined) return new Set();
  return new Set(items.filter((item) => item.canonicalMangaId === canonicalMangaId).map((item) => item.listId));
}

export function countItemsByList(items: UserListItem[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const item of items) counts.set(item.listId, (counts.get(item.listId) || 0) + 1);
  return counts;
}

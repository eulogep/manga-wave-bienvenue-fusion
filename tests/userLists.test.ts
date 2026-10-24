import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  applyListOrder,
  countItemsByList,
  isSystemList,
  listIdsContainingManga,
  MAX_LIST_NOTE_LENGTH,
  moveListItem,
  nextCustomListPosition,
  normalizeListNote,
  sortListItems,
  sortUserLists,
  validateListName,
  type UserList,
  type UserListItem,
} from '../src/domain/userLists.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20261019100000_add_user_lists.sql');

const list = (id: number, name: string, kind: UserList['kind'] = 'custom', position = 3): UserList => ({
  id, name, kind, position, createdAt: '2026-10-19T10:00:00.000Z',
});
const item = (id: number, listId: number, canonicalMangaId: number, position: number): UserListItem => ({
  id, listId, canonicalMangaId, position, note: null, createdAt: '2026-10-19T10:00:00.000Z',
});

const systemLists = [list(1, 'À lire', 'to_read', 0), list(2, 'En pause', 'on_hold', 1), list(3, 'Terminé', 'completed', 2)];

test('list names are trimmed, required, limited to 60 characters and unique regardless of case', () => {
  assert.deepEqual(validateListName('  Fantasy   sombre ', systemLists), { ok: true, name: 'Fantasy sombre', error: null });
  assert.equal(validateListName('   ', systemLists).ok, false);
  assert.equal(validateListName('x'.repeat(61), systemLists).ok, false);
  assert.equal(validateListName('à LIRE', systemLists).ok, false);
});

test('renaming a list to its own name is allowed', () => {
  assert.equal(validateListName('Terminé', systemLists, 3).ok, true);
});

test('system lists come first in a fixed order, custom lists follow by position', () => {
  const sorted = sortUserLists([list(9, 'Zeta', 'custom', 4), systemLists[2], list(8, 'Alpha', 'custom', 3), systemLists[0], systemLists[1]]);
  assert.deepEqual(sorted.map((entry) => entry.name), ['À lire', 'En pause', 'Terminé', 'Alpha', 'Zeta']);
  assert.equal(isSystemList(systemLists[0]), true);
  assert.equal(isSystemList(list(8, 'Alpha')), false);
});

test('a new custom list is appended after the system lists and existing custom lists', () => {
  assert.equal(nextCustomListPosition(systemLists), 3);
  assert.equal(nextCustomListPosition([...systemLists, list(8, 'Alpha', 'custom', 7)]), 8);
});

test('moving an item swaps it with its neighbour and refuses moves past the edges', () => {
  const items = [item(10, 1, 100, 0), item(11, 1, 101, 1), item(12, 1, 102, 2)];
  assert.deepEqual(moveListItem(items, 12, 'up'), [10, 12, 11]);
  assert.deepEqual(moveListItem(items, 10, 'down'), [11, 10, 12]);
  assert.equal(moveListItem(items, 10, 'up'), null);
  assert.equal(moveListItem(items, 12, 'down'), null);
  assert.equal(moveListItem(items, 99, 'up'), null);
});

test('applying an order rewrites positions so the sorted list follows it', () => {
  const items = [item(10, 1, 100, 0), item(11, 1, 101, 1), item(12, 1, 102, 2)];
  assert.deepEqual(sortListItems(applyListOrder(items, [12, 10, 11])).map((entry) => entry.id), [12, 10, 11]);
});

test('private notes are trimmed, empty notes become null and long notes are capped', () => {
  assert.equal(normalizeListNote('  relire le tome 3 '), 'relire le tome 3');
  assert.equal(normalizeListNote('   '), null);
  assert.equal(normalizeListNote(undefined), null);
  assert.equal(normalizeListNote('a'.repeat(600))?.length, MAX_LIST_NOTE_LENGTH);
});

test('membership and counts are derived from canonical manga ids', () => {
  const items = [item(10, 1, 100, 0), item(11, 2, 100, 0), item(12, 2, 101, 1)];
  assert.deepEqual([...listIdsContainingManga(items, 100)].sort(), [1, 2]);
  assert.equal(listIdsContainingManga(items, null).size, 0);
  assert.deepEqual([...countItemsByList(items)], [[1, 1], [2, 2]]);
});

test('migration enables RLS and scopes every policy to the owner', () => {
  assert.match(migration, /alter table public\.user_lists enable row level security/);
  assert.match(migration, /alter table public\.user_list_items enable row level security/);
  const policies = [...migration.matchAll(/create policy[\s\S]*?;/g)].map((match) => match[0]);
  assert.equal(policies.length, 8);
  for (const policy of policies) assert.match(policy, /\(select auth\.uid\(\)\) = user_id/);
});

test('clients can create only custom lists or the three exact system list pairs', () => {
  assert.match(migration, /kind = 'custom'/);
  assert.match(migration, /kind = 'to_read' and name = 'À lire'/);
  assert.match(migration, /kind = 'on_hold' and name = 'En pause'/);
  assert.match(migration, /kind = 'completed' and name = 'Terminé'/);
  assert.match(migration, /for delete to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id and kind = 'custom'\)/);
  assert.match(migration, /grant update \(name, position\) on public\.user_lists to authenticated/);
  assert.doesNotMatch(migration, /grant update on public\.user_lists/);
});

test('authenticated users receive explicit access to both identity sequences', () => {
  assert.match(migration, /grant usage, select on sequence public\.user_lists_id_seq to authenticated/);
  assert.match(migration, /grant usage, select on sequence public\.user_list_items_id_seq to authenticated/);
});

test('an item can only reference a list owned by the same user', () => {
  assert.match(migration, /foreign key \(list_id, user_id\) references public\.user_lists\(id, user_id\)/);
  // RLS also checks list ownership so a foreign list's contents cannot be probed via unique errors.
  assert.match(migration, /where list\.id = list_id and list\.user_id = \(select auth\.uid\(\)\)/);
});

test('the invoker function only creates lists for the authenticated caller and is not exposed to anon', () => {
  const body = migration.slice(migration.indexOf('function public.ensure_default_user_lists'));
  assert.match(body, /caller uuid := auth\.uid\(\)/);
  assert.match(body, /if caller is null then/);
  assert.match(body, /security invoker/);
  assert.doesNotMatch(body, /security definer/);
  assert.match(body, /set search_path = public/);
  assert.match(migration, /revoke all on function public\.ensure_default_user_lists\(\) from public, anon/);
});

test('the manga detail page and the library expose list management', () => {
  assert.match(read('src/pages/MangaDetail.tsx'), /<AddToListMenu canonicalMangaId=/);
  const library = read('src/pages/Library.tsx');
  assert.match(library, /<UserListsPanel selectedListId=\{selectedListId\}/);
  assert.match(library, /variant="submenu"/);
});

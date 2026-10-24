import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalMangaIdFromLocation } from '../src/domain/commandSearch.ts';
import { matchCollections } from '../src/domain/collections.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the palette knows the canonical manga of the page it was opened from', () => {
  assert.equal(canonicalMangaIdFromLocation('/manga/573', ''), 573);
  assert.equal(canonicalMangaIdFromLocation('/manga/573/', '?tab=chapters'), 573);
});

test('provider-scoped, malformed or unrelated pages give no manga context', () => {
  assert.equal(canonicalMangaIdFromLocation('/manga/abc-def', ''), null);
  assert.equal(canonicalMangaIdFromLocation('/manga/573', '?source=mangadex'), null);
  assert.equal(canonicalMangaIdFromLocation('/manga/0', ''), null);
  assert.equal(canonicalMangaIdFromLocation('/library', ''), null);
  assert.equal(canonicalMangaIdFromLocation('/read/mangadex/1/2', ''), null);
});

test('collections are searchable by title, tagline or slug, accents and case ignored', () => {
  assert.deepEqual(matchCollections('isekai').map((collection) => collection.slug), ['isekai']);
  assert.ok(matchCollections('TERMINEES').some((collection) => collection.slug === 'series-terminees'));
  assert.ok(matchCollections('donjons').some((collection) => collection.slug === 'manhwas-action'));
  assert.deepEqual(matchCollections('i'), []);
});

test('palette wires contextual manga actions, collection results and signed-in shortcuts', () => {
  const dialog = read('src/components/CommandSearchDialog.tsx');
  assert.match(dialog, /<CommandMangaActions mangaId=\{contextMangaId\}/);
  assert.match(dialog, /heading="Collections"/);
  assert.match(dialog, /navigate\('\/library\?view=lists'\)/);
  assert.match(dialog, /navigate\('\/stats'\)/);
  const actions = read('src/components/CommandMangaActions.tsx');
  assert.match(actions, /\{user && <SignedInActions/);
  assert.match(actions, /list\.kind === 'to_read'/);
});

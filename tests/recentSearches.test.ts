import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  addRecentSearch,
  matchRecentSearches,
  MAX_RECENT_SEARCH_LENGTH,
  MAX_RECENT_SEARCHES,
  parseRecentSearches,
  removeRecentSearch,
} from '../src/domain/recentSearches.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('a committed search moves to the front and replaces equivalent earlier entries', () => {
  assert.deepEqual(addRecentSearch(['Berserk', 'one piece'], '  One   Piece '), ['One Piece', 'Berserk']);
});

test('history is bounded to the most recent searches', () => {
  const many = Array.from({ length: 12 }, (_, index) => `titre ${index}`).reduce(addRecentSearch, [] as string[]);
  assert.equal(many.length, MAX_RECENT_SEARCHES);
  assert.equal(many[0], 'titre 11');
});

test('stray keystrokes and blank queries are not recorded', () => {
  const current = ['Berserk'];
  assert.equal(addRecentSearch(current, 'a'), current);
  assert.equal(addRecentSearch(current, '   '), current);
  assert.equal(addRecentSearch(['x'], 'z'.repeat(400))[0].length, MAX_RECENT_SEARCH_LENGTH);
});

test('removing a search matches it regardless of case and spacing', () => {
  assert.deepEqual(removeRecentSearch(['One Piece', 'Berserk'], 'one  piece'), ['Berserk']);
});

test('stored history is parsed defensively', () => {
  assert.deepEqual(parseRecentSearches(null), []);
  assert.deepEqual(parseRecentSearches('not json'), []);
  assert.deepEqual(parseRecentSearches('{"q":"x"}'), []);
  assert.deepEqual(parseRecentSearches('["Berserk", 42, null, "berserk", "Frieren"]'), ['Berserk', 'Frieren']);
});

test('suggestions extend what is typed and skip the exact current query', () => {
  const recent = ['Solo Leveling', 'One Piece', 'Solo Max-Level Newbie'];
  assert.deepEqual(matchRecentSearches(recent, 'solo'), ['Solo Leveling', 'Solo Max-Level Newbie']);
  assert.deepEqual(matchRecentSearches(recent, 'one piece'), []);
  assert.deepEqual(matchRecentSearches(recent, '', 2), ['Solo Leveling', 'One Piece']);
});

test('history stays in the browser: the hook only uses localStorage, never the network', () => {
  const hook = read('src/hooks/useRecentSearches.ts');
  assert.match(hook, /window\.localStorage/);
  assert.doesNotMatch(hook, /supabase|fetch\(/);
});

test('typing alone never records: the search page records on submit, recent pick or result click', () => {
  const page = read('src/pages/Search.tsx');
  assert.match(page, /const submit = \(event: FormEvent\) => \{ event\.preventDefault\(\); recordSearch\(draft\)/);
  assert.match(page, /onClickCapture=\{recordOnResultClick\}/);
  const debounce = page.slice(page.indexOf('useEffect(() => {\n    if (draft.trim()'), page.indexOf('const active ='));
  assert.doesNotMatch(debounce, /recordSearch/);
});

test('the command palette lists and records recent searches', () => {
  const dialog = read('src/components/CommandSearchDialog.tsx');
  assert.match(dialog, /heading="Recherches récentes"/);
  assert.match(dialog, /if \(hasQuery\) recordSearch\(trimmedQuery\)/);
  assert.match(dialog, /data-testid="command-recent-clear"/);
});

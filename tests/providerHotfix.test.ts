import assert from 'node:assert/strict';
import test from 'node:test';
import { filterRelevantMangaResults } from '../src/domain/providerRelevance.ts';
import { moveReaderPage, withReaderPage } from '../src/domain/readerNavigation.ts';
import { canonicalProgressKey, mergeCanonicalProgress } from '../src/domain/canonicalProgress.ts';

test('rejects irrelevant MangaFire search results', () => {
  const results = filterRelevantMangaResults('Solo Leveling', [
    { title: 'Solo Leveling' },
    { title: 'Solo Leveling: Ragnarok' },
    { title: 'The Regressed Mercenary Has a Plan' },
  ]);
  assert.deepEqual(results.map((result) => result.title), ['Solo Leveling', 'Solo Leveling: Ragnarok']);
});

test('AsuraScans paged navigation changes image, indicator state and URL coherently', () => {
  const pages = ['asura-1.webp', 'asura-2.webp', 'asura-3.webp'];
  let current = 0;
  current = moveReaderPage(current, pages.length, 'next');
  assert.equal(current, 1);
  assert.equal(pages[current], 'asura-2.webp');
  current = moveReaderPage(current, pages.length, 'next');
  assert.equal(current, 2);
  current = moveReaderPage(current, pages.length, 'previous');
  assert.equal(current, 1);
  assert.equal(withReaderPage(new URLSearchParams('lang=en&page=0'), current).toString(), 'lang=en&page=1');
});

test('canonical progress keeps one latest entry across providers', () => {
  const canonicalKey = canonicalProgressKey('Solo Leveling');
  const merged = mergeCanonicalProgress([
    { canonicalKey, mangaTitle: 'Solo Leveling', readAt: '2026-08-29T10:00:00Z', source: 'asurascans' },
    { canonicalKey, mangaTitle: 'Solo Leveling', readAt: '2026-08-29T11:00:00Z', source: 'originmanga' },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'originmanga');
});

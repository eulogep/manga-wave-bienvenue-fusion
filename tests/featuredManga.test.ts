import assert from 'node:assert/strict';
import test from 'node:test';
import { selectFeaturedWorks, slideOffset } from '../src/domain/featuredManga.ts';
import type { SearchWork } from '../src/domain/canonicalSearch.ts';
const work = (id: number, extra: Partial<SearchWork> = {}): SearchWork => ({ id, title: `Manga ${id}`, aliases: [], author: null, genre: [], manga_type: null, status: 'ongoing', cover_image: 'https://example.test/cover.jpg', rating: null, views: 0, created_at: '2026-01-01', content_rating: null, ...extra });
test('canonical trend order is deduplicated and fallback is honestly labelled', () => {
  const rows = selectFeaturedWorks([work(1), work(2), work(3)], [2, 2, 404]);
  assert.deepEqual(rows.map(x => [x.work.id, x.badge]), [[2,'Tendance'], [1,'Découverte'], [3,'Découverte']]);
});
test('spotlight excludes explicit artwork, missing covers and noncanonical ids', () => {
  assert.deepEqual(selectFeaturedWorks([work(1,{content_rating:'erotica'}),work(-1),work(2,{cover_image:null}),work(3)], [1,-1,2]).map(x=>x.work.id), [3]);
});
test('selection has bounded size and stable ordering without mutating the catalog', () => {
  const rows=[work(2),work(1)]; selectFeaturedWorks(rows, []);
  assert.deepEqual(rows.map(x=>x.id),[2,1]);
  assert.equal(selectFeaturedWorks(Array.from({length:12},(_,i)=>work(i+1)),[]).length,7);
  assert.equal(selectFeaturedWorks(rows,[],0).length,0);
});
test('circular placement has exactly five visible slots for seven works', () => {
  for(let active=0;active<7;active++) {
    const offsets=Array.from({length:7},(_,i)=>slideOffset(i,active,7));
    assert.equal(new Set(offsets).size,7);
    assert.equal(offsets.filter(x=>Math.abs(x)<=2).length,5);
    assert.equal(offsets[active],0);
  }
  assert.equal(slideOffset(0,0,0),0);
});

test('the hero query (trending ids + most recent eligible) selects exactly what the full catalogue would', async () => {
  const { FEATURED_LIMIT } = await import('../src/domain/featuredManga.ts');
  const day = (n: number) => new Date(Date.UTC(2026, 10, n)).toISOString();
  const catalogue = Array.from({ length: 60 }, (_, index) => work(index + 1, {
    created_at: day(1 + (index % 20)),
    cover_image: index % 7 === 0 ? null : `c${index}`,
    content_rating: index % 11 === 0 ? 'erotica' : index % 3 === 0 ? null : 'safe',
  }));
  const trendingIds = [44, 3, 21, 7, 999];
  // Mirrors useFeaturedWorks: trending rows by id, plus recent rows with a cover, not explicit.
  const recent = catalogue
    .filter((entry) => entry.cover_image !== null && entry.content_rating !== 'erotica')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id - b.id)
    .slice(0, FEATURED_LIMIT + 5);
  const trending = catalogue.filter((entry) => trendingIds.includes(entry.id));
  for (const ids of [trendingIds, []]) {
    assert.deepEqual(
      selectFeaturedWorks([...trending, ...recent], ids).map((entry) => `${entry.work.id}:${entry.badge}`),
      selectFeaturedWorks(catalogue, ids).map((entry) => `${entry.work.id}:${entry.badge}`),
    );
  }
});

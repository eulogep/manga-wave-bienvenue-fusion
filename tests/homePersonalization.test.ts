import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnonymousHomeCatalog, buildPersonalizedHomeCatalog, rankFavoriteGenres } from '../src/domain/homePersonalization.ts';

const mangas = [
  { id: 1, title: 'Alpha', genre: ['Action', 'Fantasy'], status: 'ongoing', manga_type: 'manga', rating: 8, views: 100, source_updated_at: '2026-08-29', created_at: '2026-01-01' },
  { id: 2, title: 'Beta', genre: ['Action'], status: 'completed', manga_type: 'manhwa', rating: 7, views: 500, source_updated_at: '2026-08-28', created_at: '2026-01-01' },
  { id: 3, title: 'Gamma', genre: ['Romance'], status: 'ongoing', manga_type: 'manhua', rating: 9, views: 50, source_updated_at: '2026-08-27', created_at: '2026-01-01' },
  { id: 4, title: 'Delta', genre: ['Action', 'Fantasy'], status: 'completed', manga_type: 'manga', rating: 6, views: 20, source_updated_at: '2026-08-26', created_at: '2026-01-01' },
];

test('favorite genres are ranked from the authenticated library', () => {
  assert.deepEqual(rankFavoriteGenres(mangas, [1, 2]), ['Action', 'Fantasy']);
});

test('For You favors shared genres and excludes existing favorites', () => {
  const home = buildPersonalizedHomeCatalog(mangas, [1], 3);
  assert.equal(home.forYou[0].id, 4);
  assert.equal(home.forYou.some((manga) => manga.id === 1), false);
});

test('authenticated homepage exposes updated, trending and completed groups', () => {
  const home = buildPersonalizedHomeCatalog(mangas, [], 4);
  assert.deepEqual(home.newChapters.map(({ id }) => id), [1, 3]);
  assert.equal(home.trending.length, 4);
  assert.deepEqual(home.completed.map(({ id }) => id), [2, 4]);
});

test('anonymous homepage creates latest, popular, formats and deterministic discovery', () => {
  const home = buildAnonymousHomeCatalog(mangas, 2, 4);
  assert.deepEqual(home.latest.map(({ id }) => id), [1, 2, 3, 4]);
  assert.deepEqual(home.formats, ['manga', 'manhua', 'manhwa']);
  assert.deepEqual(home.randomDiscovery.map(({ id }) => id), [3, 4, 1, 2]);
});

// T-3024: `trending`/`popular` no longer depend on mangas.views or
// mangas.rating (audited as dead/untrustworthy in T-3022/T-3023) — they are
// ordered by real catalog recency instead.
test('the "trending"/"popular" cold-start pool is ordered by real recency, not views/rating', () => {
  const skewedByFakeRating = [
    { id: 10, title: 'Old but "rated" 10', genre: [], status: 'ongoing', manga_type: 'manga', rating: 10, views: 999_999, source_updated_at: '2020-01-01', created_at: '2020-01-01' },
    { id: 11, title: 'Recent, no rating', genre: [], status: 'ongoing', manga_type: 'manga', rating: null, views: 0, source_updated_at: '2026-09-01', created_at: '2020-01-01' },
  ];
  const home = buildAnonymousHomeCatalog(skewedByFakeRating, 0, 2);
  assert.deepEqual(home.popular.map(({ id }) => id), [11, 10]);
});

test('follows contribute to genre affinity alongside favorites (T-3014 signal was previously ignored)', () => {
  assert.deepEqual(rankFavoriteGenres(mangas, [], [1, 2]), ['Action', 'Fantasy']);
});

test('For You excludes followed works too, not only favorites', () => {
  const home = buildPersonalizedHomeCatalog(mangas, [], 3, [1]);
  assert.equal(home.forYou.some((manga) => manga.id === 1), false);
});

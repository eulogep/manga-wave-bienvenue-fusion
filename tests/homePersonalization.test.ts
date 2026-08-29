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

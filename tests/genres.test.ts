import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canonicalGenre,
  genreLabel,
  inferMangaType,
  normalizeGenres,
  normalizeWorkMetadata,
} from '../src/domain/genres.ts';
import { filterSearchResults, searchCanonicalWorks, type SearchState, type SearchWork } from '../src/domain/canonicalSearch.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('language and scanlation markers are not genres', () => {
  for (const tag of ['EN', 'en', 'VF', 'Scan FR', 'Français', 'VOSTFR', 'RAW']) assert.equal(canonicalGenre(tag), null, tag);
});

test('format markers are not genres', () => {
  for (const tag of ['Manhwa', 'Manga', 'Manhua', 'Webtoon', 'Manhwa P']) assert.equal(canonicalGenre(tag), null, tag);
});

test('French and English spellings collapse to one canonical genre', () => {
  assert.deepEqual(
    normalizeGenres(['Drama', 'Drame', 'Comedy', 'Comédie', 'Adventure', 'Aventure', 'Mystère', 'Tranche de vie', 'Slice of Life']),
    ['Drama', 'Comedy', 'Adventure', 'Mystery', 'Slice of Life'],
  );
  assert.deepEqual(normalizeGenres(['Erotique', 'Pornhwa', 'Smut']), ['Smut']);
});

test('real catalogue tag mix: only true genres remain, deduplicated and in source order', () => {
  assert.deepEqual(normalizeGenres(['Action', 'EN', 'Manhwa', 'Fantasy', 'Scan FR', 'action', 'Isekai']), ['Action', 'Fantasy', 'Isekai']);
  assert.deepEqual(normalizeGenres(null), []);
});

test('unknown genres are kept as-is rather than silently dropped', () => {
  assert.equal(canonicalGenre('  Cyberpunk '), 'Cyberpunk');
});

test('prototype property names never resolve to inherited values', () => {
  assert.equal(canonicalGenre('constructor'), 'constructor');
  assert.equal(genreLabel('toString'), 'toString');
  assert.equal(inferMangaType(null, ['constructor']), null);
});

test('labels are French and accept raw or canonical input', () => {
  assert.equal(genreLabel('Comedy'), 'Comédie');
  assert.equal(genreLabel('Comédie'), 'Comédie');
  assert.equal(genreLabel('Slice of Life'), 'Tranche de vie');
  assert.equal(genreLabel('Cyberpunk'), 'Cyberpunk');
});

test('a missing type is inferred from format tags, a known type is kept', () => {
  assert.equal(inferMangaType(null, ['Action', 'Manhwa']), 'manhwa');
  assert.equal(inferMangaType('', ['Manhwa P']), 'manhwa');
  assert.equal(inferMangaType(null, ['Webtoon']), null);
  assert.equal(inferMangaType('manga', ['Manhwa']), 'manga');
});

const work = (id: number, genre: string[], manga_type: string | null = null): SearchWork => normalizeWorkMetadata({
  id, title: `Titre ${id}`, aliases: [], author: null, genre, manga_type, status: 'ongoing',
  cover_image: null, rating: null, views: 0, created_at: '2026-10-01T00:00:00.000Z', content_rating: 'safe',
});
const state = (patch: Partial<SearchState>): SearchState => ({ q: '', type: '', status: '', genre: '', sort: 'az', page: 1, browse: true, ...patch });

test('genre filters match across languages, so old French links keep working', () => {
  const works = [work(1, ['Comédie']), work(2, ['Comedy']), work(3, ['Drama'])];
  assert.deepEqual(filterSearchResults(works, state({ genre: 'Comedy' })).map((entry) => entry.id), [1, 2]);
  assert.deepEqual(filterSearchResults(works, state({ genre: 'Comédie' })).map((entry) => entry.id), [1, 2]);
});

test('the type filter finds works whose type was only stored as a genre tag', () => {
  const works = [work(1, ['Action', 'Manhwa']), work(2, ['Action'], 'manga')];
  assert.deepEqual(filterSearchResults(works, state({ type: 'manhwa' })).map((entry) => entry.id), [1]);
});

test('searching a French genre label finds works tagged with the English key', () => {
  assert.deepEqual(searchCanonicalWorks([work(1, ['Comedy']), work(2, ['Drama'])], state({ q: 'comédie' })).map((entry) => entry.id), [1]);
});

test('both catalogue loaders normalize metadata before any consumer sees it', () => {
  assert.match(read('src/hooks/useCanonicalSearch.ts'), /works\.push\(\.\.\.data\.map\(normalizeWorkMetadata\)\)/);
  assert.match(read('src/hooks/useManga.tsx'), /normalizeWorkMetadata\(\{ \.\.\.row, description: null, artist: null \}\)/);
});

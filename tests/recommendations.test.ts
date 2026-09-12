import assert from 'node:assert/strict';
import test from 'node:test';
import { findSimilarWorks, SIMILARITY_WEIGHTS, type SimilarityCandidate } from '../src/domain/recommendations.ts';

const work = (
  id: number,
  title: string,
  genre: string[],
  author: string | null = null,
  manga_type: string | null = 'manga',
  status = 'ongoing',
): SimilarityCandidate => ({ id, title, genre, author, manga_type, status });

test('never uses mangas.rating or mangas.views: the candidate shape has no such fields', () => {
  const candidate = work(1, 'A', ['Action']);
  assert.deepEqual(Object.keys(candidate).sort(), ['author', 'genre', 'id', 'manga_type', 'status', 'title']);
});

test('the target work never recommends itself', () => {
  const target = work(1, 'A', ['Action']);
  const results = findSimilarWorks(target, [target, work(2, 'B', ['Action'])]);
  assert.equal(results.some((result) => result.canonicalMangaId === 1), false);
});

test('a shared genre produces a match, weighted by the documented weight', () => {
  const target = work(1, 'A', ['Action'], null, null);
  const [result] = findSimilarWorks(target, [target, work(2, 'B', ['Action'], null, null)]);
  assert.equal(result.canonicalMangaId, 2);
  assert.deepEqual(result.sharedGenres, ['Action']);
  assert.equal(result.score, SIMILARITY_WEIGHTS.sharedGenre);
});

test('more shared genres score higher than fewer', () => {
  const target = work(1, 'A', ['Action', 'Fantasy', 'Isekai']);
  const results = findSimilarWorks(target, [
    target,
    work(2, 'Two genres', ['Action', 'Fantasy']),
    work(3, 'One genre', ['Action']),
  ]);
  assert.deepEqual(results.map((result) => result.canonicalMangaId), [2, 3]);
});

test('the same named author is a strong signal even with no shared genre', () => {
  const target = work(1, 'A', ['Action'], 'Eiichiro Oda', null);
  const [result] = findSimilarWorks(target, [target, work(2, 'B', ['Romance'], 'Eiichiro Oda', null)]);
  assert.equal(result.canonicalMangaId, 2);
  assert.equal(result.sameAuthor, true);
  assert.equal(result.score, SIMILARITY_WEIGHTS.sameAuthor);
});

test('author matching is accent/case-insensitive but never fuzzy across different people', () => {
  const target = work(1, 'A', [], 'Ōda Eiichirō', null);
  const [same] = findSimilarWorks(target, [target, work(2, 'B', [], 'oda eiichiro', null)]);
  assert.equal(same.sameAuthor, true);
  const [different] = findSimilarWorks(target, [target, work(3, 'C', [], 'Oda Eiichi', null)]);
  assert.equal(different, undefined); // no shared genre, no exact author match -> zero score, excluded
});

test('matching format (manga/manhwa/manhua) is a light tie-breaker, never the primary signal', () => {
  const target = work(1, 'A', ['Action'], null, 'manhwa');
  const results = findSimilarWorks(target, [
    target,
    work(2, 'Same genre, different format', ['Action'], null, 'manga'),
    work(3, 'Same genre, same format', ['Action'], null, 'manhwa'),
  ]);
  assert.equal(results[0].canonicalMangaId, 3);
  assert.equal(results[0].score, SIMILARITY_WEIGHTS.sharedGenre + SIMILARITY_WEIGHTS.sameType);
});

test('no overlap at all is excluded, never a fabricated "similar" result', () => {
  const target = work(1, 'A', ['Action'], 'Author A', 'manga');
  const results = findSimilarWorks(target, [target, work(2, 'B', ['Romance'], 'Author B', 'manhua')]);
  assert.deepEqual(results, []);
});

test('results are limited and deterministic, ties broken by canonical manga id', () => {
  const target = work(1, 'A', ['Action']);
  const catalog = [
    target,
    work(2, 'B', ['Action']),
    work(3, 'C', ['Action']),
    work(4, 'D', ['Action']),
  ];
  const results = findSimilarWorks(target, catalog, 2);
  assert.deepEqual(results.map((result) => result.canonicalMangaId), [2, 3]);
  assert.deepEqual(results, findSimilarWorks(target, catalog, 2));
});

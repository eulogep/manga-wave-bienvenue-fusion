import assert from 'node:assert/strict';
import test from 'node:test';
import type { SearchWork } from '../src/domain/canonicalSearch.ts';
import {
  eligibleRandomWorks,
  parseRandomFilters,
  selectRandomWork,
} from '../src/domain/randomDiscovery.ts';

const work = (id: number, manga_type: string | null = 'manga', status = 'ongoing'): SearchWork => ({
  id,
  title: `Work ${id}`,
  aliases: [],
  author: null,
  genre: [],
  manga_type,
  status,
  cover_image: null,
  rating: null,
  views: 0,
  created_at: '2026-01-01T00:00:00Z',
});

test('parses only supported URL filters and rejects unknown values', () => {
  assert.deepEqual(parseRandomFilters(new URLSearchParams('type=manhwa&status=completed')), { type: 'manhwa', status: 'completed' });
  assert.deepEqual(parseRandomFilters(new URLSearchParams('type=novel&status=published')), { type: '', status: '' });
});

test('filters by canonical type and status using AND semantics', () => {
  const catalog = [work(1), work(2, 'manhwa'), work(3, 'manhwa', 'completed')];
  assert.deepEqual(eligibleRandomWorks(catalog, { type: 'manhwa', status: 'completed' }).map(({ id }) => id), [3]);
});

test('deduplicates canonical ids before drawing', () => {
  assert.deepEqual(eligibleRandomWorks([work(1), work(1), work(2)], { type: '', status: '' }).map(({ id }) => id), [1, 2]);
});

test('selects across the whole eligible pool with injectable randomness', () => {
  const catalog = [work(1), work(2), work(3)];
  assert.equal(selectRandomWork(catalog, { type: '', status: '' }, undefined, () => 0)?.id, 1);
  assert.equal(selectRandomWork(catalog, { type: '', status: '' }, undefined, () => 0.5)?.id, 2);
  assert.equal(selectRandomWork(catalog, { type: '', status: '' }, undefined, () => 1)?.id, 3);
});

test('never repeats the current work immediately when another work is eligible', () => {
  const catalog = [work(1), work(2), work(3)];
  for (const value of [0, 0.49, 0.99]) {
    assert.notEqual(selectRandomWork(catalog, { type: '', status: '' }, 2, () => value)?.id, 2);
  }
});

test('keeps the sole eligible work instead of producing a false empty state', () => {
  assert.equal(selectRandomWork([work(1, 'manhua')], { type: 'manhua', status: '' }, 1, () => 0)?.id, 1);
});

test('returns null for an honestly empty filtered pool', () => {
  assert.equal(selectRandomWork([work(1)], { type: 'manhwa', status: '' }), null);
});

test('malformed random values fail closed to the first eligible work', () => {
  assert.equal(selectRandomWork([work(1), work(2)], { type: '', status: '' }, undefined, () => Number.NaN)?.id, 1);
  assert.equal(selectRandomWork([work(1), work(2)], { type: '', status: '' }, undefined, () => -4)?.id, 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mangasoriginesExtractor,
  normalizeMangasOriginesStatus,
} from '../dist/sources/mangasorigines-extractor.js';
import {
  normalizeScantradStatus,
  scantradExtractor,
  waitForScantradChapterListing,
} from '../dist/sources/scantrad-extractor.js';
import { extractors } from '../dist/sources/index.js';

test('dedicated French sources implement the complete extractor contract', () => {
  for (const extractor of [mangasoriginesExtractor, scantradExtractor]) {
    assert.equal(typeof extractor.search, 'function');
    assert.equal(typeof extractor.getPopular, 'function');
    assert.equal(typeof extractor.getDetail, 'function');
    assert.equal(typeof extractor.getPages, 'function');
    assert.equal(extractors[extractor.id], extractor);
  }
});

test('source status labels are normalized without weakening unknown values', () => {
  assert.equal(normalizeMangasOriginesStatus('Terminé'), 'completed');
  assert.equal(normalizeMangasOriginesStatus('En pause'), 'hiatus');
  assert.equal(normalizeMangasOriginesStatus('En cours'), 'ongoing');
  assert.equal(normalizeScantradStatus('Completed'), 'completed');
  assert.equal(normalizeScantradStatus('Hiatus'), 'hiatus');
  assert.equal(normalizeScantradStatus('OnGoing'), 'ongoing');
});

test('empty searches do not contact a remote source', async () => {
  assert.deepEqual(await mangasoriginesExtractor.search('   '), []);
  assert.deepEqual(await scantradExtractor.search('   '), []);
});

test('Scantrad waits for the AJAX chapter listing before parsing details', async () => {
  const calls = [];
  const page = {
    waitForSelector: async (selector, options) => calls.push({ selector, options }),
  };

  await waitForScantradChapterListing(page);

  assert.deepEqual(calls, [{
    selector: '.listing-chapters_wrap .wp-manga-chapter a',
    options: { state: 'attached', timeout: 15_000 },
  }]);
});

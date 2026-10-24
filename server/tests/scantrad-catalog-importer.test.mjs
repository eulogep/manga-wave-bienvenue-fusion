import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScantradImportArtifacts,
  normalizeCatalogTitle,
} from '../dist/importers/scantrad-catalog-importer.js';

const listing = (id, title) => ({
  id,
  title,
  coverUrl: `https://images.example/${id}.jpg`,
  status: 'ongoing',
  rating: 4.5,
  genres: [],
  author: null,
  url: `https://manga-scantrad.io/manga/${id}/`,
});

const detail = (id, title, chapters = []) => ({
  id,
  title,
  coverUrl: `https://images.example/${id}.jpg`,
  author: 'Auteur',
  status: 'ongoing',
  genres: ['Action'],
  synopsis: `Synopsis ${id}`,
  chapters,
});

test('catalog title normalization is deterministic across accents and punctuation', () => {
  assert.equal(normalizeCatalogTitle('  L’Épée-du Héros!  '), 'l epee du heros');
});

test('preview artifacts merge metadata, flag duplicates, and expose quality totals', () => {
  const listings = [listing('alpha', 'L’Épée du Héros'), listing('beta', 'L Epee du Heros')];
  const details = new Map([
    ['alpha', detail('alpha', 'L’Épée du Héros', [{
      id: 'chapter-1', chapterNumber: '1', title: null, date: '2026-10-24', language: 'fr', url: 'https://manga-scantrad.io/manga/alpha/chapitre-1/',
    }])],
    ['beta', detail('beta', 'L Epee du Heros')],
  ]);

  const artifacts = buildScantradImportArtifacts({
    listings,
    details,
    failures: [],
    generatedAt: '2026-10-24T17:00:00.000Z',
  });

  assert.equal(artifacts.preview.items.length, 2);
  assert.equal(artifacts.preview.items[0].sourceId, 'alpha');
  assert.equal(artifacts.preview.items[0].chapters.length, 1);
  assert.deepEqual(artifacts.report.duplicateTitleGroups, [[
    'alpha',
    'beta',
  ]]);
  assert.deepEqual(artifacts.report.totals, {
    discovered: 2,
    detailed: 2,
    failed: 0,
    withCover: 2,
    withSynopsis: 2,
    withChapters: 1,
    chapters: 1,
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_DOCUMENT_DESCRIPTION,
  DEFAULT_DOCUMENT_TITLE,
  MAX_DESCRIPTION_LENGTH,
  buildCanonicalMangaUrl,
  formatChapterLabel,
  formatDocumentDescription,
  formatDocumentTitle,
  toPublicHttpUrl,
} from '../src/domain/documentMetadata.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('page titles join non-empty parts and end with the site name', () => {
  assert.equal(formatDocumentTitle('One Piece', 'Chapitre 12'), 'One Piece — Chapitre 12 · Manga Wave');
  assert.equal(formatDocumentTitle('  Ma   bibliothèque '), 'Ma bibliothèque · Manga Wave');
  assert.equal(formatDocumentTitle(undefined, 'Chapitre 3', ''), 'Chapitre 3 · Manga Wave');
});

test('no usable title part falls back to the homepage title from index.html', () => {
  assert.equal(formatDocumentTitle(), DEFAULT_DOCUMENT_TITLE);
  assert.equal(formatDocumentTitle(null, '   '), DEFAULT_DOCUMENT_TITLE);
  assert.ok(read('index.html').includes(`<title>${DEFAULT_DOCUMENT_TITLE}</title>`));
  assert.ok(read('index.html').includes(`name="description" content="${DEFAULT_DOCUMENT_DESCRIPTION}"`));
});

test('descriptions are whitespace-normalized and cut on a word boundary', () => {
  assert.equal(formatDocumentDescription('  Un  pirate\n\ncherche un trésor. '), 'Un pirate cherche un trésor.');
  assert.equal(formatDocumentDescription(''), DEFAULT_DOCUMENT_DESCRIPTION);
  const long = formatDocumentDescription('mot '.repeat(80));
  assert.ok(long.length <= MAX_DESCRIPTION_LENGTH);
  assert.ok(long.endsWith('mot…'));
});

test('chapter labels are omitted when the chapter number is unknown', () => {
  assert.equal(formatChapterLabel('12.5'), 'Chapitre 12.5');
  assert.equal(formatChapterLabel(''), null);
  assert.equal(formatChapterLabel(undefined), null);
});

test('canonical manga URLs exclude provider parameters and encode the identity', () => {
  assert.equal(
    buildCanonicalMangaUrl('https://manga-wave.example/search?source=test', '42'),
    'https://manga-wave.example/manga/42',
  );
  assert.equal(buildCanonicalMangaUrl('https://manga-wave.example', 'a b'), 'https://manga-wave.example/manga/a%20b');
  assert.equal(buildCanonicalMangaUrl('https://manga-wave.example', '  '), null);
});

test('social metadata accepts public URLs and rejects executable schemes', () => {
  assert.equal(toPublicHttpUrl('/cover.jpg', 'https://manga-wave.example'), 'https://manga-wave.example/cover.jpg');
  assert.equal(toPublicHttpUrl('https://cdn.example/cover.jpg', 'https://manga-wave.example'), 'https://cdn.example/cover.jpg');
  assert.equal(toPublicHttpUrl('javascript:alert(1)', 'https://manga-wave.example'), null);
  assert.equal(toPublicHttpUrl('data:text/html,unsafe', 'https://manga-wave.example'), null);
});

test('every routed page sets its own document title', () => {
  for (const page of ['Auth', 'History', 'Library', 'MangaDetail', 'NotFound', 'Random', 'Ranking', 'Reader', 'Search', 'Trending']) {
    assert.match(read(`src/pages/${page}.tsx`), /useDocumentMetadata\(/, `${page} should call useDocumentMetadata`);
  }
});

test('an adult-gated manga detail does not leak its title or synopsis into the tab metadata', () => {
  const source = read('src/pages/MangaDetail.tsx');
  assert.match(source, /isAdultGated \? 'Contenu réservé aux adultes' : manga\.title/);
  assert.match(source, /manga && !isAdultGated \? manga\.description : null/);
  assert.match(source, /manga && !isAdultGated \? manga\.coverImageUrl : null/);
});

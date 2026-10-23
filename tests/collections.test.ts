import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  collectionWorks,
  distinctTileCovers,
  EDITORIAL_COLLECTIONS,
  findCollection,
  MIN_COLLECTION_SIZE,
  publishedCollections,
} from '../src/domain/collections.ts';
import type { SearchWork } from '../src/domain/canonicalSearch.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

let nextId = 1;
const work = (patch: Partial<SearchWork> = {}): SearchWork => ({
  id: nextId++, title: `Titre ${nextId}`, aliases: [], author: null, genre: [], manga_type: null, status: 'ongoing',
  cover_image: null, rating: null, views: 0, created_at: '2026-10-01T00:00:00.000Z', content_rating: 'safe', ...patch,
});
const isekai = findCollection('isekai')!;

test('slugs are unique and URL-safe', () => {
  const slugs = EDITORIAL_COLLECTIONS.map((collection) => collection.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(findCollection('inconnue'), null);
  assert.equal(findCollection(undefined), null);
});

test('rules use canonical metadata: manhwa action needs both the type and the genre', () => {
  const rule = findCollection('manhwas-action')!;
  assert.equal(rule.matches(work({ manga_type: 'manhwa', genre: ['Action'] })), true);
  assert.equal(rule.matches(work({ manga_type: 'manga', genre: ['Action'] })), false);
  assert.equal(rule.matches(work({ manga_type: 'manhwa', genre: ['Romance'] })), false);
});

test('adult works never enter a collection, whatever their genres', () => {
  const works = [work({ genre: ['Isekai'], content_rating: 'erotica' }), work({ genre: ['Isekai', 'Smut'] }), work({ genre: ['Isekai'] })];
  assert.equal(collectionWorks(isekai, works).length, 1);
});

test('works are ranked by readership, then rating, then title for a stable shared order', () => {
  const works = [
    work({ title: 'B', genre: ['Isekai'], views: 10 }),
    work({ title: 'A', genre: ['Isekai'], views: 10 }),
    work({ title: 'C', genre: ['Isekai'], views: 10, rating: 4.5 }),
    work({ title: 'D', genre: ['Isekai'], views: 99 }),
  ];
  assert.deepEqual(collectionWorks(isekai, works).map((entry) => entry.title), ['D', 'C', 'A', 'B']);
});

test('the same work imported from two sources is shown once, keeping the most-read entry', () => {
  const works = [
    work({ title: 'Copying Skills!', author: 'Kim', genre: ['Isekai'], views: 5 }),
    work({ title: 'copying  skills', author: 'kim', genre: ['Isekai'], views: 50 }),
    work({ title: 'Copying Skills!', author: 'Other author', genre: ['Isekai'], views: 1 }),
  ];
  const shown = collectionWorks(isekai, works);
  assert.equal(shown.length, 2);
  assert.equal(shown[0].views, 50);
});

test('near-empty collections are not published', () => {
  const few = Array.from({ length: MIN_COLLECTION_SIZE - 1 }, () => work({ genre: ['Isekai'] }));
  assert.equal(publishedCollections(few).some(({ collection }) => collection.slug === 'isekai'), false);
  const enough = [...few, work({ genre: ['Isekai'] })];
  assert.equal(publishedCollections(enough).some(({ collection }) => collection.slug === 'isekai'), true);
});

test('feel-good excludes tragedies and horror even when they are also comedies', () => {
  const rule = findCollection('feel-good')!;
  assert.equal(rule.matches(work({ genre: ['Comedy'] })), true);
  assert.equal(rule.matches(work({ genre: ['Comedy', 'Tragedy'] })), false);
});

test('collection pages are routed, titled, shareable and reachable from navigation', () => {
  const app = read('src/App.tsx');
  assert.match(app, /path="\/collections" element=\{<Collections \/>\}/);
  assert.match(app, /path="\/collections\/:slug" element=\{<Collection \/>\}/);
  const page = read('src/pages/Collection.tsx');
  assert.match(page, /canonicalUrl: collection \? `\/collections\/\$\{collection\.slug\}` : null/);
  assert.match(page, /if \(!collection\) return <NotFound \/>/);
  assert.match(read('src/pages/Collections.tsx'), /useDocumentMetadata\(/);
  assert.match(read('src/components/Header.tsx'), /\{ label: 'Collections', to: '\/collections'/);
  assert.match(read('src/components/CommandSearchDialog.tsx'), /navigate\('\/collections'\)/);
});

test('collection tiles avoid repeating covers already shown on earlier tiles', () => {
  const shared = work({ cover_image: 'shared.jpg' });
  const a = [shared, work({ cover_image: 'a1.jpg' }), work({ cover_image: 'a2.jpg' })];
  const b = [shared, work({ cover_image: 'b1.jpg' }), work({ cover_image: null }), work({ cover_image: 'b2.jpg' }), work({ cover_image: 'b3.jpg' })];
  const [first, second] = distinctTileCovers([{ collection: isekai, works: a }, { collection: isekai, works: b }]);
  assert.ok(first.includes(shared));
  assert.ok(!second.includes(shared));
  assert.ok(second.every((entry) => entry.cover_image));
});

test('a tile reuses an earlier cover only when it lacks fresh ones', () => {
  const shared = work({ cover_image: 'shared.jpg' });
  const [, second] = distinctTileCovers([
    { collection: isekai, works: [shared] },
    { collection: isekai, works: [shared, work({ cover_image: 'only.jpg' })] },
  ]);
  assert.deepEqual(second.map((entry) => entry.cover_image), ['only.jpg', 'shared.jpg']);
});

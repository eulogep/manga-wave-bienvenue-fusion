import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReaderLocation,
  createReaderPageTransition,
  shouldHydrateReaderPage,
  withReaderPage,
} from '../src/domain/readerNavigation.ts';

test('AsuraScans next-page advances chapter 5 from page 1 to page 2', () => {
  const transition = createReaderPageTransition(0, 26, 'next');
  assert.equal(transition.pageIndex, 1);
});

test('AsuraScans repeated next-page advances chapter 5 to page 3', () => {
  const transition = createReaderPageTransition(1, 26, 'next');
  assert.equal(transition.pageIndex, 2);
});

test('AsuraScans previous-page returns chapter 5 from page 3 to page 2', () => {
  const transition = createReaderPageTransition(2, 26, 'previous');
  assert.equal(transition.pageIndex, 1);
});

test('URL page query follows the canonical Reader page index', () => {
  const search = withReaderPage(new URLSearchParams('lang=en&page=0'), 2);
  assert.equal(search.get('page'), '2');
  assert.equal(search.get('lang'), 'en');
});

test('progress is derived from the same page transition', () => {
  const transition = createReaderPageTransition(0, 26, 'next');
  assert.equal(transition.progressPercent, 8);
});

test('URL synchronization cannot rehydrate and reset the same Reader identity', () => {
  assert.equal(
    shouldHydrateReaderPage('asurascans:chapter-5', 'asurascans:chapter-5'),
    false,
  );
});

test('chapter or source changes explicitly rehydrate the Reader', () => {
  assert.equal(
    shouldHydrateReaderPage('asurascans:chapter-5', 'originmanga:chapter-5'),
    true,
  );
});

test('manual Reader source switch targets the matched OriginManga chapter 5', () => {
  const location = buildReaderLocation({
    source: 'originmanga',
    mangaId: 'solo-leveling',
    chapterId: 'origin-chapter-5',
    language: 'fr',
    pageIndex: 1,
  });
  assert.match(location, /^\/read\/originmanga\/solo-leveling\/origin-chapter-5\?/);
  assert.doesNotMatch(location, /chapter-1(?:\?|$)/);
});

test('manual Reader source switch preserves the current page index', () => {
  const location = buildReaderLocation({
    source: 'originmanga',
    mangaId: 'solo-leveling',
    chapterId: 'origin-chapter-5',
    language: 'fr',
    pageIndex: 7,
  });
  assert.equal(new URL(`https://manga-wave.test${location}`).searchParams.get('page'), '7');
});

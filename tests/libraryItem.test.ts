import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  aggregateLibraryItems,
  filterLibraryItems,
  isCompleted,
  isInProgress,
  searchLibraryItems,
  sortLibraryItems,
} from '../src/domain/libraryItem.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const emptyInput = () => ({ favorites: [], follows: [], progress: [], updates: [] });

test('a favorite-only manga appears in Favorites but not Following', () => {
  const [item] = aggregateLibraryItems({
    ...emptyInput(),
    favorites: [{ canonicalMangaId: 1, title: 'Manga A', favoritedAt: '2026-09-01T00:00:00.000Z' }],
  });
  assert.equal(item.favorite, true);
  assert.equal(item.following, false);
  assert.equal(filterLibraryItems([item], 'favorites').length, 1);
  assert.equal(filterLibraryItems([item], 'following').length, 0);
});

test('a follow-only manga appears in Following but never becomes a Favorite', () => {
  const [item] = aggregateLibraryItems({
    ...emptyInput(),
    follows: [{ canonicalMangaId: 2, title: 'Manga B', followedAt: '2026-09-01T00:00:00.000Z' }],
  });
  assert.equal(item.following, true);
  assert.equal(item.favorite, false);
  assert.equal(filterLibraryItems([item], 'following').length, 1);
  assert.equal(filterLibraryItems([item], 'favorites').length, 0);
});

test('favorite + follow on the same canonical manga renders one item eligible in both filters', () => {
  const items = aggregateLibraryItems({
    ...emptyInput(),
    favorites: [{ canonicalMangaId: 3, title: 'Manga C', favoritedAt: '2026-09-01T00:00:00.000Z' }],
    follows: [{ canonicalMangaId: 3, title: 'Manga C', followedAt: '2026-09-02T00:00:00.000Z' }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].favorite, true);
  assert.equal(items[0].following, true);
  assert.equal(filterLibraryItems(items, 'favorites').length, 1);
  assert.equal(filterLibraryItems(items, 'following').length, 1);
  assert.equal(filterLibraryItems(items, 'all').length, 1);
});

test('reading progress marks a manga "En cours" with a resolvable Resume target', () => {
  const [item] = aggregateLibraryItems({
    ...emptyInput(),
    progress: [{
      canonicalMangaId: 4,
      canonicalKey: 'manga:4',
      title: 'Manga D',
      chapterNumber: '5',
      progressPercent: 40,
      readAt: '2026-09-03T00:00:00.000Z',
      source: 'originmanga',
      providerMangaId: 'origin-manga-d',
      chapterId: 'chapter-5',
      language: 'fr',
      pageIndex: 1,
    }],
  });
  assert.equal(item.hasProgress, true);
  assert.equal(isInProgress(item), true);
  assert.equal(item.resume?.chapterId, 'chapter-5');
  assert.equal(item.resume?.pageIndex, 1);
});

test('a completed series is excluded from "En cours" even with progress', () => {
  const [item] = aggregateLibraryItems({
    ...emptyInput(),
    favorites: [{ canonicalMangaId: 5, title: 'Manga E', status: 'completed', favoritedAt: '2026-09-01T00:00:00.000Z' }],
    progress: [{
      canonicalMangaId: 5,
      canonicalKey: 'manga:5',
      title: 'Manga E',
      chapterNumber: '10',
      progressPercent: 100,
      readAt: '2026-09-03T00:00:00.000Z',
      source: 'originmanga',
      providerMangaId: 'origin-manga-e',
      chapterId: 'chapter-10',
      language: 'fr',
      pageIndex: 0,
    }],
  });
  assert.equal(isInProgress(item), false);
  assert.equal(isCompleted(item), true);
});

test('unread update flags the manga as having new content until it is read', () => {
  const [item] = aggregateLibraryItems({
    ...emptyInput(),
    follows: [{ canonicalMangaId: 6, title: 'Manga F', followedAt: '2026-09-01T00:00:00.000Z' }],
    updates: [{
      canonicalMangaId: 6,
      title: 'Manga F',
      chapterNumber: '12',
      provider: 'asurascans',
      providerMangaId: 'asura-manga-f',
      providerChapterId: 'chapter-12',
      language: 'fr',
      firstSeenAt: '2026-09-04T00:00:00.000Z',
      unreadCount: 2,
    }],
  });
  assert.equal(item.unreadUpdate?.count, 2);
  assert.equal(filterLibraryItems([item], 'updates').length, 1);
});

test('canonical dedup: same canonical manga discovered through two provider contexts renders once', () => {
  const items = aggregateLibraryItems({
    ...emptyInput(),
    favorites: [{ canonicalMangaId: 7, title: 'Manga G', favoritedAt: '2026-09-01T00:00:00.000Z' }],
    follows: [{ canonicalMangaId: 7, title: 'Manga G', followedAt: '2026-09-02T00:00:00.000Z' }],
    progress: [{
      canonicalMangaId: 7,
      canonicalKey: 'manga:7',
      title: 'Manga G',
      chapterNumber: '3',
      progressPercent: 20,
      readAt: '2026-09-03T00:00:00.000Z',
      source: 'originmanga',
      providerMangaId: 'origin-manga-g',
      chapterId: 'chapter-3-origin',
      language: 'fr',
      pageIndex: 0,
    }],
    updates: [{
      canonicalMangaId: 7,
      title: 'Manga G',
      chapterNumber: '4',
      provider: 'asurascans',
      providerMangaId: 'asura-manga-g',
      providerChapterId: 'chapter-4-asura',
      language: 'fr',
      firstSeenAt: '2026-09-04T00:00:00.000Z',
      unreadCount: 1,
    }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].favorite && items[0].following && items[0].hasProgress && Boolean(items[0].unreadUpdate), true);
});

test('sort by recent activity surfaces the most recently touched item first', () => {
  const items = aggregateLibraryItems({
    ...emptyInput(),
    favorites: [
      { canonicalMangaId: 8, title: 'Older', favoritedAt: '2026-08-01T00:00:00.000Z' },
      { canonicalMangaId: 9, title: 'Newer', favoritedAt: '2026-09-05T00:00:00.000Z' },
    ],
  });
  const sorted = sortLibraryItems(items, 'activity');
  assert.equal(sorted[0].title, 'Newer');
});

test('library search matches by (normalized) title', () => {
  const items = aggregateLibraryItems({
    ...emptyInput(),
    favorites: [
      { canonicalMangaId: 10, title: 'Solo Leveling', favoritedAt: '2026-09-01T00:00:00.000Z' },
      { canonicalMangaId: 11, title: 'One Piece', favoritedAt: '2026-09-01T00:00:00.000Z' },
    ],
  });
  const results = searchLibraryItems(items, 'solo lvl'.replace('lvl', 'leveling'));
  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Solo Leveling');
});

test('resume never surfaces a provider identity as the card primary field', () => {
  const page = read('src/pages/Library.tsx');
  assert.doesNotMatch(page, /Source\s*:/);
  assert.match(page, /Reprendre/);
});

test('Library reads canonical signals only, never queries providers per card', () => {
  const hook = read('src/hooks/useLibraryItems.ts');
  assert.match(hook, /user_favorites/);
  assert.match(hook, /user_canonical_reading_progress/);
  assert.doesNotMatch(hook, /getSource\(/);
});

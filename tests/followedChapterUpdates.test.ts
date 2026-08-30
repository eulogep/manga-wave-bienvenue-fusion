import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  dedupeDetectedChapters,
  reconcileFollowedChapters,
  type DetectedFollowedChapter,
  type FollowedChapterState,
} from '../src/domain/followedChapterUpdates.ts';
import { buildReaderLocation } from '../src/domain/readerNavigation.ts';

const observedAt = '2026-08-30T12:00:00.000Z';
const chapter = (number: string, provider = 'originmanga'): DetectedFollowedChapter => ({
  mangaId: 110,
  canonicalChapterKey: number.replace(/\.0$/, ''),
  chapterNumber: number,
  chapterTitle: `Chapitre ${number}`,
  provider,
  providerMangaId: 'solo-leveling',
  providerChapterId: `${provider}-${number}`,
  language: 'fr',
});
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('first observation establishes a read baseline instead of flagging the existing catalog', () => {
  const result = reconcileFollowedChapters([chapter('200'), chapter('199')], [], observedAt);
  assert.equal(result.isBaseline, true);
  assert.equal(result.rowsToInsert.length, 2);
  assert.ok(result.rowsToInsert.every((item) => item.readAt === observedAt));
  assert.equal(result.unread.length, 0);
});

test('a chapter detected after the baseline is marked new', () => {
  const existing: FollowedChapterState[] = [{
    ...chapter('200'),
    firstSeenAt: '2026-08-29T12:00:00.000Z',
    readAt: '2026-08-29T12:00:00.000Z',
  }];
  const result = reconcileFollowedChapters([chapter('201'), chapter('200')], existing, observedAt);
  assert.equal(result.isBaseline, false);
  assert.equal(result.rowsToInsert.length, 1);
  assert.equal(result.unread[0].canonicalChapterKey, '201');
  assert.equal(result.unread[0].readAt, null);
});

test('the same logical chapter from multiple providers is shown once', () => {
  const result = dedupeDetectedChapters([
    chapter('201.0', 'originmanga'),
    { ...chapter('201', 'asurascans'), canonicalChapterKey: '201' },
  ]);
  assert.equal(result.length, 1);
});

test('the new state disappears after that exact chapter is read', () => {
  const existing: FollowedChapterState[] = [{
    ...chapter('201'),
    firstSeenAt: observedAt,
    readAt: '2026-08-30T12:05:00.000Z',
  }];
  const result = reconcileFollowedChapters([chapter('201')], existing, '2026-08-30T12:06:00.000Z');
  assert.equal(result.unread.length, 0);
  assert.equal(result.rowsToInsert.length, 0);
});

test('a new chapter opens directly in the canonical Reader route', () => {
  const url = buildReaderLocation({
    source: 'originmanga',
    mangaId: 'solo-leveling',
    chapterId: 'originmanga-201',
    language: 'fr',
    pageIndex: 0,
    mangaTitle: 'Solo Leveling',
  });
  assert.match(url, /^\/read\/originmanga\/solo-leveling\/originmanga-201\?/);
  assert.match(url, /page=0/);
});

test('Homepage, Library and Reader are wired to the followed update state', () => {
  const homepage = read('src/components/HomeCatalogSections.tsx');
  const library = read('src/pages/Library.tsx');
  const progress = read('src/hooks/useReadingProgress.ts');
  assert.match(homepage, /<FollowedUpdatesSection \/>/);
  assert.match(library, /newChapterCount=\{update\?\.newChapterCount\}/);
  assert.match(progress, /from\('user_followed_chapter_state'\)[\s\S]*canonical_chapter_key/);
  assert.match(progress, /invalidateQueries\(\{ queryKey: \['followed-chapter-updates'\] \}\)/);
});

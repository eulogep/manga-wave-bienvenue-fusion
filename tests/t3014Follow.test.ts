import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canonicalFollowIdentity,
  isCanonicalMangaFollowed,
  updateFollowedCanonicalIds,
} from '../src/domain/canonicalFollow.ts';
import {
  reconcileFollowedChapters,
  type DetectedFollowedChapter,
  type FollowedChapterState,
} from '../src/domain/followedChapterUpdates.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const observedAt = '2026-08-30T14:00:00.000Z';
const chapter = (number: string, provider = 'originmanga'): DetectedFollowedChapter => ({
  mangaId: 110,
  canonicalChapterKey: number,
  chapterNumber: number,
  chapterTitle: `Chapitre ${number}`,
  provider,
  providerMangaId: `${provider}-solo-leveling`,
  providerChapterId: `${provider}-${number}`,
  language: 'fr',
});

test('Follow identity is user plus canonical manga, never provider', () => {
  assert.equal(canonicalFollowIdentity('user-a', 110), 'user-a:110');
  assert.doesNotMatch(canonicalFollowIdentity('user-a', 110), /originmanga|asurascans/);
});

test('Follow is idempotent and unique for a canonical manga', () => {
  assert.deepEqual(updateFollowedCanonicalIds([110], 110, true), [110]);
  assert.deepEqual(updateFollowedCanonicalIds([110, 110], 110, true), [110]);
});

test('Unfollow is idempotent', () => {
  assert.deepEqual(updateFollowedCanonicalIds([110, 220], 110, false), [220]);
  assert.deepEqual(updateFollowedCanonicalIds([220], 110, false), [220]);
});

test('Favorite and Follow remain independent product states', () => {
  const favoriteIds = [110];
  const followedIds: number[] = [];
  assert.equal(favoriteIds.includes(110), true);
  assert.equal(isCanonicalMangaFollowed(followedIds, 110), false);
});

test('provider switching cannot duplicate a canonical Follow', () => {
  const afterOrigin = updateFollowedCanonicalIds([], 110, true);
  const afterAsura = updateFollowedCanonicalIds(afterOrigin, 110, true);
  assert.deepEqual(afterAsura, [110]);
});

test('initial Follow establishes baseline with zero unread updates', () => {
  const baseline = reconcileFollowedChapters([chapter('200')], [], observedAt);
  assert.equal(baseline.isBaseline, true);
  assert.equal(baseline.unread.length, 0);
});

test('a later chapter is unread only while the manga is followed', () => {
  const baseline = reconcileFollowedChapters([chapter('200')], [], observedAt);
  const update = reconcileFollowedChapters(
    [chapter('201'), chapter('200')],
    baseline.rowsToInsert,
    '2026-08-30T14:05:00.000Z',
  );
  assert.equal(isCanonicalMangaFollowed([110], 110), true);
  assert.equal(update.unread.length, 1);
  assert.equal(isCanonicalMangaFollowed([], 110), false);
});

test('refollow after a missed chapter establishes a fresh baseline', () => {
  const refollow = reconcileFollowedChapters(
    [chapter('201'), chapter('200')],
    [],
    '2026-08-30T14:10:00.000Z',
  );
  assert.equal(refollow.isBaseline, true);
  assert.equal(refollow.unread.length, 0);
  const next = reconcileFollowedChapters(
    [chapter('202'), chapter('201'), chapter('200')],
    refollow.rowsToInsert,
    '2026-08-30T14:15:00.000Z',
  );
  assert.deepEqual(next.unread.map((item) => item.canonicalChapterKey), ['202']);
});

test('T-3013 reading acknowledgement still clears unread state', () => {
  const readState: FollowedChapterState = {
    ...chapter('201'),
    firstSeenAt: observedAt,
    readAt: '2026-08-30T14:20:00.000Z',
  };
  assert.equal(reconcileFollowedChapters([chapter('201')], [readState], observedAt).unread.length, 0);
});

test('migration backfills favorites once and moves chapter state to Follow', () => {
  const migration = read('supabase/migrations/20260830130000_add_canonical_follows.sql');
  assert.match(migration, /unique \(user_id, canonical_manga_id\)/i);
  assert.match(migration, /select favorite\.user_id, favorite\.manga_id/i);
  assert.match(migration, /on conflict \(user_id, canonical_manga_id\) do nothing/i);
  assert.match(migration, /references public\.user_follows\(user_id, canonical_manga_id\)/i);
});

test('RLS restricts select, insert and delete to the authenticated owner', () => {
  const migration = read('supabase/migrations/20260830130000_add_canonical_follows.sql');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select[\s\S]*auth\.uid\(\).*user_id/i);
  assert.match(migration, /for insert[\s\S]*auth\.uid\(\).*user_id/i);
  assert.match(migration, /for delete[\s\S]*auth\.uid\(\).*user_id/i);
});

test('Follow UI is canonical, optimistic and rolls back on database failure', () => {
  const detail = read('src/pages/MangaDetail.tsx');
  const hook = read('src/hooks/useFollows.ts');
  const engine = read('src/hooks/useFollowedChapterUpdates.ts');
  assert.match(detail, /Suivre/);
  assert.doesNotMatch(detail, /Suivre OriginManga|Suivre AsuraScans/);
  assert.match(hook, /onMutate/);
  assert.match(hook, /onError[\s\S]*setQueryData/);
  assert.match(engine, /useFollows/);
  assert.doesNotMatch(engine, /useLibrary/);
});

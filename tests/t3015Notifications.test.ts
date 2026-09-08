import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveNotificationReaderLocation } from '../src/domain/notifications.ts';
import { reconcileFollowedChapters, type DetectedFollowedChapter } from '../src/domain/followedChapterUpdates.ts';
import type { SourceChapter } from '../src/integrations/sources/types.ts';

const migration = readFileSync(
  new URL('../supabase/migrations/20260908080000_add_canonical_notifications.sql', import.meta.url),
  'utf8',
);
const observedAt = '2026-09-08T09:00:00.000Z';
const detected = (chapterNumber: string): DetectedFollowedChapter => ({
  mangaId: 110,
  canonicalChapterKey: chapterNumber,
  chapterNumber,
  chapterTitle: `Chapitre ${chapterNumber}`,
  provider: 'originmanga',
  providerMangaId: 'solo-leveling',
  providerChapterId: `origin-${chapterNumber}`,
  language: 'fr',
});

test('notification identity is canonical and unique per user, manga, chapter and type', () => {
  assert.match(migration, /unique \(user_id, canonical_manga_id, canonical_chapter_key, type\)/i);
  assert.doesNotMatch(migration.match(/unique \([^)]*\)/i)?.[0] || '', /provider|source/);
});

test('T-3013 is the sole notification event source', () => {
  assert.match(migration, /after insert on public\.user_followed_chapter_state/i);
  assert.doesNotMatch(migration, /chapter_snapshots[\s\S]*create trigger/i);
});

test('favorite-only state cannot generate a notification', () => {
  assert.match(migration, /from public\.user_follows[\s\S]*canonical_manga_id = new\.manga_id/i);
  assert.doesNotMatch(migration, /from public\.user_favorites/i);
});

test('initial Follow baseline is read and produces no historical notification', () => {
  const baseline = reconcileFollowedChapters([detected('200')], [], observedAt);
  assert.equal(baseline.rowsToInsert[0].readAt, observedAt);
  assert.match(migration, /if new\.read_at is not null then[\s\S]*return new/i);
});

test('a later canonical chapter is eligible for exactly one notification', () => {
  const baseline = reconcileFollowedChapters([detected('200')], [], observedAt);
  const update = reconcileFollowedChapters([detected('201'), detected('200')], baseline.rowsToInsert, observedAt);
  assert.deepEqual(update.unread.map((chapter) => chapter.canonicalChapterKey), ['201']);
  assert.match(migration, /on conflict \(user_id, canonical_manga_id, canonical_chapter_key, type\) do nothing/i);
});

test('multiple new chapters remain separate canonical events', () => {
  const baseline = reconcileFollowedChapters([detected('200')], [], observedAt);
  const update = reconcileFollowedChapters(
    [detected('202'), detected('201'), detected('200')],
    baseline.rowsToInsert,
    observedAt,
  );
  assert.deepEqual(update.unread.map((chapter) => chapter.canonicalChapterKey), ['202', '201']);
});

test('clients can select and update read state but cannot insert notifications', () => {
  assert.match(migration, /grant select on public\.user_notifications to authenticated/i);
  assert.match(migration, /grant update \(is_read, read_at\)/i);
  assert.doesNotMatch(migration, /grant[^;]*insert[^;]*user_notifications/i);
});

test('RLS isolates both selection and read-state updates by owner', () => {
  assert.match(migration, /for select[\s\S]*auth\.uid\(\).*user_id/i);
  assert.match(migration, /for update[\s\S]*using[\s\S]*auth\.uid\(\).*user_id[\s\S]*with check/i);
});

test('reading a T-3013 chapter acknowledges the matching notification', () => {
  assert.match(migration, /after update of read_at on public\.user_followed_chapter_state/i);
  assert.match(migration, /set is_read = true[\s\S]*canonical_chapter_key = new\.canonical_chapter_key/i);
});

test('unfollow preserves historical notifications', () => {
  assert.doesNotMatch(migration, /references public\.user_follows/);
  assert.match(migration, /canonical_manga_id bigint not null references public\.mangas/);
});

test('refollow reuses T-3013 baseline semantics without retroactive events', () => {
  const refollow = reconcileFollowedChapters([detected('201'), detected('200')], [], observedAt);
  assert.equal(refollow.isBaseline, true);
  assert.equal(refollow.unread.length, 0);
});

test('notification destination uses ranked candidates and survives first-source failure', async () => {
  const chapter = (id: string): SourceChapter => ({
    id,
    source: 'mangadex',
    chapterNumber: '201',
    title: null,
    date: observedAt,
  });
  const location = await resolveNotificationReaderLocation({
    canonicalChapterKey: '201.0',
    mangaTitle: 'Solo Leveling',
    candidates: [
      { sourceId: 'originmanga', sourceMangaId: 'origin-sl', language: 'fr', eligible: true },
      { sourceId: 'mangadex', sourceMangaId: 'dex-sl', language: 'fr', eligible: true },
    ],
    loadChapters: async (candidate) => {
      if (candidate.sourceId === 'originmanga') throw new Error('source unavailable');
      return [chapter('dex-201')];
    },
  });
  assert.match(location || '', /^\/read\/mangadex\/dex-sl\/dex-201\?/);
  assert.doesNotMatch(migration, /reader_path|source_hint|provider_chapter_id/);
});

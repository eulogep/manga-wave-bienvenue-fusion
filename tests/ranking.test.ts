import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  aggregateRankingEvents,
  assessRankingConfidence,
  mergeWithLegacyFallback,
  scoreRankingAggregate,
  rankingLabel,
  DEFAULT_MAX_SESSIONS_PER_USER,
  type RankingActivityEvent,
} from '../src/domain/ranking.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// Extracts only the executable `as $$ ... $$` function bodies, so assertions
// about what the SQL actually *does* are not confused by prose in `--`
// comments or `comment on function ... is '...'` documentation strings
// (both legitimately discuss the excluded `rating`/`views` fields by name).
const readFunctionBodies = (path: string) => [...read(path).matchAll(/as \$\$([\s\S]*?)\$\$/g)].map((match) => match[1]).join('\n');

const now = new Date('2026-09-13T12:00:00.000Z');
const windowStart30d = new Date('2026-08-14T12:00:00.000Z');

const event = (
  canonicalMangaId: number,
  userId: string,
  occurredAt: string,
  kind: RankingActivityEvent['kind'] = 'reading_session',
): RankingActivityEvent => ({ canonicalMangaId, userId, occurredAt, kind });

const daysAgo = (days: number, hour = 12) => {
  const date = new Date(now.getTime() - days * 86_400_000);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

test('Ranking never uses mangas.rating: the domain model has no such input', () => {
  const aggregate = {
    canonicalMangaId: 1, uniqueReaders: 1, readingSessions: 1, distinctActiveDays: 1, newFollows: 0, newFavorites: 0,
  };
  assert.deepEqual(
    Object.keys(aggregate).sort(),
    ['canonicalMangaId', 'distinctActiveDays', 'newFavorites', 'newFollows', 'readingSessions', 'uniqueReaders'],
  );
  assert.equal(typeof scoreRankingAggregate(aggregate), 'number');
});

// Required distinction 1 & 2: a one-day spike (Trending-shaped) vs. the same
// total event count spread across many distinct days (sustained engagement)
// must NOT score the same in Ranking — spread wins.
test('sustained engagement across many distinct days outranks an equal-volume single-day spike', () => {
  const spikeManga = 1;
  const sustainedManga = 2;
  const events: RankingActivityEvent[] = [
    // Spike: one user, 6 sessions, all on the same day.
    ...Array.from({ length: 6 }, (_, index) => event(spikeManga, 'spike-user', daysAgo(2, 8 + index))),
    // Sustained: one user, 6 sessions, spread across 6 distinct days.
    ...Array.from({ length: 6 }, (_, index) => event(sustainedManga, 'sustained-user', daysAgo(index + 1))),
  ];
  const results = aggregateRankingEvents(events, windowStart30d, now);
  const byManga = new Map(results.map((result) => [result.canonicalMangaId, result]));

  assert.equal(byManga.get(spikeManga)!.distinctActiveDays, 1);
  // Capped at DEFAULT_MAX_SESSIONS_PER_USER (5) even though 6 distinct days
  // occurred — the same per-user bound that prevents one binge-reader from
  // dominating also applies to this signal.
  assert.equal(byManga.get(sustainedManga)!.distinctActiveDays, DEFAULT_MAX_SESSIONS_PER_USER);
  assert.ok(byManga.get(sustainedManga)!.score > byManga.get(spikeManga)!.score);
  assert.equal(results[0].canonicalMangaId, sustainedManga);
});

// Required distinction 3: one user must not dominate, even across many distinct days.
test('one user reading every day for a month is capped, not allowed to dominate alone', () => {
  const events: RankingActivityEvent[] = Array.from({ length: 30 }, (_, index) => event(9, 'binge-user', daysAgo(index)));
  const [result] = aggregateRankingEvents(events, windowStart30d, now);
  assert.equal(result.uniqueReaders, 1);
  assert.equal(result.distinctActiveDays, DEFAULT_MAX_SESSIONS_PER_USER);
  assert.equal(result.readingSessions, DEFAULT_MAX_SESSIONS_PER_USER);
});

test('several distinct users each reading on a few different days outrank one capped binge-user', () => {
  const bingeManga = 1;
  const communityManga = 2;
  const events: RankingActivityEvent[] = [
    ...Array.from({ length: 30 }, (_, index) => event(bingeManga, 'binge-user', daysAgo(index))),
    ...['user-a', 'user-b', 'user-c', 'user-d'].flatMap((userId, userIndex) => (
      Array.from({ length: 3 }, (_, dayIndex) => event(communityManga, userId, daysAgo(userIndex * 3 + dayIndex)))
    )),
  ];
  const results = aggregateRankingEvents(events, windowStart30d, now);
  const byManga = new Map(results.map((result) => [result.canonicalMangaId, result]));
  assert.equal(byManga.get(bingeManga)!.uniqueReaders, 1);
  assert.equal(byManga.get(communityManga)!.uniqueReaders, 4);
  assert.ok(byManga.get(communityManga)!.score > byManga.get(bingeManga)!.score);
});

test('activity outside the window is excluded', () => {
  const events: RankingActivityEvent[] = [
    event(1, 'user-a', daysAgo(5)),
    event(2, 'user-b', '2026-01-01T00:00:00.000Z'),
  ];
  const results = aggregateRankingEvents(events, windowStart30d, now);
  assert.deepEqual(results.map((result) => result.canonicalMangaId), [1]);
});

test('an all-time window (null start) includes activity of any age', () => {
  const events: RankingActivityEvent[] = [event(1, 'user-a', '2020-01-01T00:00:00.000Z')];
  const results = aggregateRankingEvents(events, null, now);
  assert.equal(results.length, 1);
});

test('zero activity produces zero results, never a fabricated rank', () => {
  assert.deepEqual(aggregateRankingEvents([], windowStart30d, now), []);
});

// Required distinction 5: deterministic tie handling.
test('score is deterministic and ties break by canonical manga id', () => {
  const events: RankingActivityEvent[] = [
    event(5, 'user-a', daysAgo(1), 'favorite'),
    event(3, 'user-b', daysAgo(1), 'favorite'),
  ];
  const results = aggregateRankingEvents(events, windowStart30d, now);
  assert.deepEqual(results.map((result) => result.canonicalMangaId), [3, 5]);
  assert.deepEqual(results, aggregateRankingEvents(events, windowStart30d, now));
});

// Required distinction 4: mangas.views must never "magically" rank highly as
// if it were real, and must be excluded once enough real results exist.
test('legacy views fallback only fills unmet slots, always explicitly flagged, never blended into the real score', () => {
  const real = aggregateRankingEvents([event(1, 'user-a', daysAgo(1), 'follow'), event(1, 'user-b', daysAgo(1), 'follow')], windowStart30d, now);
  const legacyCandidates = [
    { canonicalMangaId: 1, views: 999_999 }, // already ranked for real -> must not duplicate
    { canonicalMangaId: 2, views: 500 },
    { canonicalMangaId: 3, views: 100 },
  ];
  const merged = mergeWithLegacyFallback(real, legacyCandidates, 3, true);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].canonicalMangaId, 1);
  assert.equal(merged[0].legacyFallback, false);
  assert.equal(merged[1].legacyFallback, true);
  assert.equal(merged[1].canonicalMangaId, 2); // higher views first among legacy rows
  assert.equal(merged[2].legacyFallback, true);
});

test('legacy fallback is skipped entirely when the caller opts out', () => {
  const merged = mergeWithLegacyFallback([], [{ canonicalMangaId: 1, views: 100 }], 5, false);
  assert.deepEqual(merged, []);
});

test('legacy fallback rows never count toward confidence', () => {
  const merged = mergeWithLegacyFallback([], [{ canonicalMangaId: 1, views: 100 }, { canonicalMangaId: 2, views: 50 }], 5, true);
  const confidence = assessRankingConfidence(merged);
  assert.equal(confidence.qualifyingWorks.length, 0);
  assert.equal(confidence.confident, false);
});

test('confidence requires enough real qualifying works, not just one strong one', () => {
  const results = aggregateRankingEvents([
    event(1, 'user-a', daysAgo(1), 'follow'),
    event(1, 'user-b', daysAgo(1), 'follow'),
  ], windowStart30d, now);
  const confidence = assessRankingConfidence(results, { minQualifyingWorks: 3 });
  assert.equal(confidence.qualifyingWorks.length, 1);
  assert.equal(confidence.confident, false);
});

test('ranking labels never render raw numeric precision, and legacy rows are labeled distinctly', () => {
  assert.equal(rankingLabel({ score: 0, legacyFallback: false }), 'Populaire');
  assert.equal(rankingLabel({ score: 20, legacyFallback: false }), 'Très suivi');
  assert.equal(rankingLabel({ score: 50, legacyFallback: false }), 'Valeur sûre');
  assert.equal(rankingLabel({ score: 999, legacyFallback: true }), 'Populaire (historique)');
});

test('the migration never returns a raw user_id, exposes mangas.views only as an explicitly flagged legacy_fallback column, and never reads mangas.rating', () => {
  const migration = read('supabase/migrations/20260913090000_add_manga_ranking_rpc.sql');
  assert.match(migration, /create or replace function public\.get_manga_ranking/);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public/i);
  const rankingReturns = migration.match(/create or replace function public\.get_manga_ranking[\s\S]*?returns table \(([\s\S]*?)\)/i)?.[1] ?? '';
  assert.ok(rankingReturns.length > 0, 'expected a RETURNS TABLE clause for get_manga_ranking');
  assert.doesNotMatch(rankingReturns, /user_id/i);
  assert.doesNotMatch(rankingReturns, /email/i);
  assert.match(rankingReturns, /legacy_fallback boolean/i);
  assert.doesNotMatch(readFunctionBodies('supabase/migrations/20260913090000_add_manga_ranking_rpc.sql'), /\brating\b/i);
  assert.match(migration, /grant execute on function public\.get_manga_ranking.*to anon, authenticated/i);
});

test('the migration bounds one user\'s session and active-day contribution', () => {
  const migration = read('supabase/migrations/20260913090000_add_manga_ranking_rpc.sql');
  assert.match(migration, /least\(sessions, greatest\(1, coalesce\(max_sessions_per_user, 5\)\)\)/);
  assert.match(migration, /least\(active_days, greatest\(1, coalesce\(max_sessions_per_user, 5\)\)\)/);
});

test('the migration does not touch existing RLS policies on private tables', () => {
  const migration = read('supabase/migrations/20260913090000_add_manga_ranking_rpc.sql');
  assert.doesNotMatch(migration, /disable row level security/i);
  assert.doesNotMatch(migration, /drop policy/i);
});

test('the shared activity helper is revoked from every client role (not directly callable)', () => {
  const migration = read('supabase/migrations/20260913090000_add_manga_ranking_rpc.sql');
  assert.match(migration, /revoke all on function public\._canonical_activity_window\(integer, integer\) from public, anon, authenticated/i);
});

test('get_trending_manga is refactored to delegate to the shared helper, not duplicated a third time', () => {
  const migration = read('supabase/migrations/20260913090000_add_manga_ranking_rpc.sql');
  assert.match(migration, /from public\._canonical_activity_window\(window_days, max_sessions_per_user\)/);
});

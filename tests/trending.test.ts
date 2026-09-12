import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  aggregateTrendingEvents,
  assessTrendingConfidence,
  scoreTrendingAggregate,
  trendingLabel,
  DEFAULT_MAX_SESSIONS_PER_USER,
  type RawActivityEvent,
} from '../src/domain/trending.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const now = new Date('2026-09-12T12:00:00.000Z');
const windowStart7d = new Date('2026-09-05T12:00:00.000Z');

const event = (
  canonicalMangaId: number,
  userId: string,
  occurredAt: string,
  kind: RawActivityEvent['kind'] = 'reading_session',
): RawActivityEvent => ({ canonicalMangaId, userId, occurredAt, kind });

test('Trending never uses mangas.views: the domain model has no such input', () => {
  // The scoring model only accepts unique readers / sessions / follows / favorites —
  // there is no `views` field anywhere in its inputs.
  const aggregate = {
    canonicalMangaId: 1, uniqueReaders: 1, readingSessions: 1, newFollows: 0, newFavorites: 0,
  };
  assert.deepEqual(
    Object.keys(aggregate).sort(),
    ['canonicalMangaId', 'newFavorites', 'newFollows', 'readingSessions', 'uniqueReaders'],
  );
  assert.equal(typeof scoreTrendingAggregate(aggregate), 'number');
});

test('more unique readers outranks repeated activity from one user', () => {
  const events: RawActivityEvent[] = [
    // Manga 1: five sessions from a single user.
    ...Array.from({ length: 5 }, (_, index) => event(1, 'user-a', `2026-09-10T0${index}:00:00.000Z`)),
    // Manga 2: three distinct users, one session each.
    event(2, 'user-b', '2026-09-10T00:00:00.000Z'),
    event(2, 'user-c', '2026-09-10T00:00:00.000Z'),
    event(2, 'user-d', '2026-09-10T00:00:00.000Z'),
  ];
  const results = aggregateTrendingEvents(events, windowStart7d, now);
  const byManga = new Map(results.map((result) => [result.canonicalMangaId, result]));
  assert.ok(byManga.get(2)!.score > byManga.get(1)!.score);
  assert.equal(results[0].canonicalMangaId, 2);
});

test('one user is capped at DEFAULT_MAX_SESSIONS_PER_USER sessions', () => {
  const events: RawActivityEvent[] = Array.from({ length: 50 }, (_, index) => (
    event(9, 'binge-user', `2026-09-10T${String(index % 24).padStart(2, '0')}:00:00.000Z`)
  ));
  const [result] = aggregateTrendingEvents(events, windowStart7d, now);
  assert.equal(result.uniqueReaders, 1);
  assert.equal(result.readingSessions, DEFAULT_MAX_SESSIONS_PER_USER);
});

test('newer activity within the window counts; activity before the window is excluded', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', '2026-09-11T00:00:00.000Z'), // inside 7d window
    event(2, 'user-b', '2026-07-01T00:00:00.000Z'), // long before the window
  ];
  const results = aggregateTrendingEvents(events, windowStart7d, now);
  assert.deepEqual(results.map((result) => result.canonicalMangaId), [1]);
});

test('zero activity in the window produces zero results, never a fabricated rank', () => {
  const results = aggregateTrendingEvents([], windowStart7d, now);
  assert.deepEqual(results, []);
});

test('follows and favorites are counted with their documented weights', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', '2026-09-10T00:00:00.000Z', 'follow'),
    event(1, 'user-b', '2026-09-10T00:00:00.000Z', 'follow'),
    event(2, 'user-c', '2026-09-10T00:00:00.000Z', 'favorite'),
  ];
  const results = aggregateTrendingEvents(events, windowStart7d, now);
  const byManga = new Map(results.map((result) => [result.canonicalMangaId, result]));
  assert.equal(byManga.get(1)!.newFollows, 2);
  assert.equal(byManga.get(2)!.newFavorites, 1);
  // Two follows (3 each = 6) outrank one favorite (2).
  assert.ok(byManga.get(1)!.score > byManga.get(2)!.score);
});

test('canonical dedup: repeated events for the same canonical manga never split into multiple rows', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', '2026-09-10T00:00:00.000Z', 'follow'),
    event(1, 'user-b', '2026-09-11T00:00:00.000Z', 'reading_session'),
    event(1, 'user-c', '2026-09-11T06:00:00.000Z', 'favorite'),
  ];
  const results = aggregateTrendingEvents(events, windowStart7d, now);
  assert.equal(results.length, 1);
  assert.equal(results[0].canonicalMangaId, 1);
});

test('score is deterministic and ties break by canonical manga id', () => {
  const events: RawActivityEvent[] = [
    event(5, 'user-a', '2026-09-10T00:00:00.000Z', 'favorite'),
    event(3, 'user-b', '2026-09-10T00:00:00.000Z', 'favorite'),
  ];
  const results = aggregateTrendingEvents(events, windowStart7d, now);
  assert.deepEqual(results.map((result) => result.canonicalMangaId), [3, 5]);
  const again = aggregateTrendingEvents(events, windowStart7d, now);
  assert.deepEqual(results, again);
});

test('minimum-sample protection excludes an isolated single-signal work and can flag low overall confidence', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', '2026-09-10T00:00:00.000Z', 'favorite'), // signal = 1, below default floor of 2
  ];
  const results = aggregateTrendingEvents(events, windowStart7d, now);
  const confidence = assessTrendingConfidence(results);
  assert.equal(confidence.qualifyingWorks.length, 0);
  assert.equal(confidence.confident, false);
});

test('confidence requires enough qualifying works, not just one strong work', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', '2026-09-10T00:00:00.000Z', 'follow'),
    event(1, 'user-b', '2026-09-10T00:00:00.000Z', 'follow'),
  ];
  const results = aggregateTrendingEvents(events, windowStart7d, now);
  const confidence = assessTrendingConfidence(results, { minQualifyingWorks: 3 });
  assert.equal(confidence.qualifyingWorks.length, 1);
  assert.equal(confidence.confident, false);
});

test('trending labels never render raw numeric precision', () => {
  assert.equal(trendingLabel(0), 'Nouveau signal');
  assert.equal(trendingLabel(12), 'En hausse');
  assert.equal(trendingLabel(30), 'Très lu cette semaine');
});

test('the RPC migration never returns a raw user_id or exposes per-user rows', () => {
  const migration = read('supabase/migrations/20260912090000_add_trending_manga_rpc.sql');
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public/i);
  const returnsClause = migration.match(/returns table \(([\s\S]*?)\)/i)?.[1] ?? '';
  assert.ok(returnsClause.length > 0, 'expected a RETURNS TABLE clause');
  assert.doesNotMatch(returnsClause, /user_id/i);
  assert.doesNotMatch(returnsClause, /email/i);
  assert.match(migration, /grant execute on function public\.get_trending_manga.*to anon, authenticated/i);
});

test('the RPC migration bounds one user\'s session contribution', () => {
  const migration = read('supabase/migrations/20260912090000_add_trending_manga_rpc.sql');
  assert.match(migration, /least\(sessions, greatest\(1, coalesce\(max_sessions_per_user, 5\)\)\)/);
});

test('the RPC migration does not touch existing RLS policies on private tables', () => {
  const migration = read('supabase/migrations/20260912090000_add_trending_manga_rpc.sql');
  assert.doesNotMatch(migration, /disable row level security/i);
  assert.doesNotMatch(migration, /drop policy/i);
});

test('trending never reads from public.mangas at all: it is pure activity aggregation', () => {
  const migration = read('supabase/migrations/20260912090000_add_trending_manga_rpc.sql');
  assert.doesNotMatch(migration, /from public\.mangas/i);
});

test('the personalized homepage no longer labels the static popularity rail as Tendances', () => {
  const home = read('src/components/HomeCatalogSections.tsx');
  assert.doesNotMatch(home, /title="Tendances"[\s\S]{0,40}mangas=\{personalized\.trending\}/);
  assert.match(home, /<TrendingSection/);
});

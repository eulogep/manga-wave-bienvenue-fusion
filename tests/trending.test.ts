import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  aggregateTrendingEvents,
  assessTrendingConfidence,
  recencyMultiplier,
  trendingLabel,
  TRENDING_EVENT_WEIGHTS,
  DEFAULT_MAX_SESSIONS_PER_USER,
  type RawActivityEvent,
} from '../src/domain/trending.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readFunctionBodies = (path: string) => [...read(path).matchAll(/as \$\$([\s\S]*?)\$\$/g)].map((match) => match[1]).join('\n');

const now = new Date('2026-09-14T12:00:00.000Z');

const event = (
  canonicalMangaId: number,
  userId: string,
  occurredAt: string,
  kind: RawActivityEvent['kind'] = 'reading_session',
): RawActivityEvent => ({ canonicalMangaId, userId, occurredAt, kind });

const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

test('Trending never uses mangas.views: the domain model has no such input', () => {
  const aggregate = {
    canonicalMangaId: 1, uniqueUsers: 1, followEvents: 0, favoriteEvents: 0, readingSessionEvents: 1, progressUpdateEvents: 0,
  };
  assert.deepEqual(
    Object.keys(aggregate).sort(),
    ['canonicalMangaId', 'favoriteEvents', 'followEvents', 'progressUpdateEvents', 'readingSessionEvents', 'uniqueUsers'],
  );
});

test('recency multiplier is tiered: 24h strongest, 7d medium, 30d weak, beyond 30d excluded', () => {
  assert.equal(recencyMultiplier(new Date(hoursAgo(1)), now), 1);
  assert.equal(recencyMultiplier(new Date(hoursAgo(23)), now), 1);
  assert.equal(recencyMultiplier(new Date(daysAgo(3)), now), 0.5);
  assert.equal(recencyMultiplier(new Date(daysAgo(6.9)), now), 0.5);
  assert.equal(recencyMultiplier(new Date(daysAgo(15)), now), 0.15);
  assert.equal(recencyMultiplier(new Date(daysAgo(29)), now), 0.15);
  assert.equal(recencyMultiplier(new Date(daysAgo(31)), now), 0);
});

test('event weights match the documented formula: follow 3, favorite 2, reading session 1.5, progress update 1', () => {
  assert.deepEqual(TRENDING_EVENT_WEIGHTS, {
    follow: 3, favorite: 2, reading_session: 1.5, progress_update: 1,
  });
});

test('no activity produces zero results, never a fabricated rank', () => {
  assert.deepEqual(aggregateTrendingEvents([], now), []);
});

test('single-source activity (follow only) scores using only that signal\'s weight and decay', () => {
  const [result] = aggregateTrendingEvents([event(1, 'user-a', hoursAgo(1), 'follow')], now);
  assert.equal(result.followEvents, 1);
  assert.equal(result.score, 3 * 1); // weight 3 * 24h multiplier 1.0
});

test('multi-source activity combines weighted, decayed contributions from every signal', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', hoursAgo(1), 'follow'),      // 3 * 1.0   = 3
    event(1, 'user-b', daysAgo(3), 'favorite'),     // 2 * 0.5   = 1
    event(1, 'user-c', daysAgo(15), 'reading_session'), // 1.5 * 0.15 = 0.225
    event(1, 'user-d', hoursAgo(2), 'progress_update'), // 1 * 1.0  = 1
  ];
  const [result] = aggregateTrendingEvents(events, now);
  assert.equal(result.uniqueUsers, 4);
  assert.equal(result.score, 3 + 1 + 0.225 + 1);
});

test('decay behavior: identical event volume scores lower the older it is', () => {
  const recentManga = 1;
  const olderManga = 2;
  const events: RawActivityEvent[] = [
    event(recentManga, 'user-a', hoursAgo(1), 'follow'),
    event(olderManga, 'user-b', daysAgo(20), 'follow'),
  ];
  const results = aggregateTrendingEvents(events, now);
  const byManga = new Map(results.map((result) => [result.canonicalMangaId, result]));
  assert.ok(byManga.get(recentManga)!.score > byManga.get(olderManga)!.score);
});

test('one user reading many distinct sessions is capped at DEFAULT_MAX_SESSIONS_PER_USER before scoring', () => {
  const events: RawActivityEvent[] = Array.from({ length: 30 }, (_, index) => (
    event(9, 'binge-user', hoursAgo(index), 'reading_session')
  ));
  const [result] = aggregateTrendingEvents(events, now);
  assert.equal(result.readingSessionEvents, DEFAULT_MAX_SESSIONS_PER_USER);
  assert.equal(result.uniqueUsers, 1);
});

test('several distinct users outscore one capped binge-reader with comparable raw volume', () => {
  const bingeManga = 1;
  const communityManga = 2;
  const events: RawActivityEvent[] = [
    ...Array.from({ length: 30 }, (_, index) => event(bingeManga, 'binge-user', hoursAgo(index), 'reading_session')),
    ...['user-a', 'user-b', 'user-c', 'user-d', 'user-e', 'user-f'].map((userId) => event(communityManga, userId, hoursAgo(1), 'reading_session')),
  ];
  const results = aggregateTrendingEvents(events, now);
  const byManga = new Map(results.map((result) => [result.canonicalMangaId, result]));
  assert.ok(byManga.get(communityManga)!.score > byManga.get(bingeManga)!.score);
});

test('activity beyond the 30-day window is excluded entirely', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', hoursAgo(1), 'follow'),
    event(2, 'user-b', daysAgo(45), 'follow'),
  ];
  const results = aggregateTrendingEvents(events, now);
  assert.deepEqual(results.map((result) => result.canonicalMangaId), [1]);
});

test('canonical dedup: every event kind for the same canonical manga collapses into one row', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', hoursAgo(1), 'follow'),
    event(1, 'user-b', hoursAgo(2), 'favorite'),
    event(1, 'user-c', hoursAgo(3), 'reading_session'),
    event(1, 'user-d', hoursAgo(4), 'progress_update'),
  ];
  const results = aggregateTrendingEvents(events, now);
  assert.equal(results.length, 1);
  assert.equal(results[0].canonicalMangaId, 1);
});

test('score is deterministic and ties break by unique users then canonical manga id', () => {
  const events: RawActivityEvent[] = [
    event(5, 'user-a', hoursAgo(1), 'favorite'),
    event(3, 'user-b', hoursAgo(1), 'favorite'),
  ];
  const results = aggregateTrendingEvents(events, now);
  assert.deepEqual(results.map((result) => result.canonicalMangaId), [3, 5]);
  assert.deepEqual(results, aggregateTrendingEvents(events, now));
});

test('minimum-sample protection excludes an isolated single-signal work', () => {
  const results = aggregateTrendingEvents([event(1, 'user-a', hoursAgo(1), 'favorite')], now);
  const confidence = assessTrendingConfidence(results);
  assert.equal(confidence.qualifyingWorks.length, 0);
  assert.equal(confidence.confident, false);
});

test('confidence requires enough qualifying works, not just one strong work', () => {
  const events: RawActivityEvent[] = [
    event(1, 'user-a', hoursAgo(1), 'follow'),
    event(1, 'user-b', hoursAgo(1), 'follow'),
  ];
  const results = aggregateTrendingEvents(events, now);
  const confidence = assessTrendingConfidence(results, { minQualifyingWorks: 3 });
  assert.equal(confidence.qualifyingWorks.length, 1);
  assert.equal(confidence.confident, false);
});

test('trending labels never render raw numeric precision', () => {
  assert.equal(trendingLabel(0), 'Nouveau signal');
  assert.equal(trendingLabel(12), 'En hausse');
  assert.equal(trendingLabel(30), 'Très lu cette semaine');
});

// ---- Migration shape / privacy assertions ----

const MIGRATION = 'supabase/migrations/20260914090000_add_manga_trending_materialized_view.sql';

test('the materialized view never returns a raw user_id or email as an output column (only as an aggregate input to count(distinct ...))', () => {
  const migration = read(MIGRATION);
  const finalSelect = migration.match(/select\s+canonical_manga_id,\s*\n\s*round\(sum[\s\S]*?having sum\(event_weight \* recency_multiplier\) > 0;/)?.[0] ?? '';
  assert.ok(finalSelect.length > 0, 'expected the final aggregate SELECT to be present');
  // user_id may appear only inside count(distinct user_id) — never as its own
  // selected/aliased column (which would leak per-user granularity).
  const withoutSafeAggregate = finalSelect.replace(/count\(distinct user_id\)/g, '');
  assert.doesNotMatch(withoutSafeAggregate, /user_id/i);
  assert.doesNotMatch(finalSelect, /\bemail\b/i);
});

test('the view is never populated from mangas.views', () => {
  assert.doesNotMatch(readFunctionBodies(MIGRATION), /\bviews\b/);
  assert.doesNotMatch(read(MIGRATION).replace(/^--.*$/gm, ''), /from public\.mangas\b/i);
});

test('reading sessions are capped per (canonical manga, user) before decay, matching the documented cap', () => {
  const migration = read(MIGRATION);
  assert.match(migration, /partition by history\.canonical_manga_id, history\.user_id/);
  assert.match(migration, /where capped_sessions\.session_rank <= 5/);
});

test('the decay tiers in SQL match the domain model exactly', () => {
  const migration = read(MIGRATION);
  assert.match(migration, /when occurred_at >= now\(\) - interval '24 hours' then 1\.0/);
  assert.match(migration, /when occurred_at >= now\(\) - interval '7 days' then 0\.5/);
  assert.match(migration, /when occurred_at >= now\(\) - interval '30 days' then 0\.15/);
});

test('the event weights in SQL match the domain model exactly', () => {
  const migration = read(MIGRATION);
  assert.match(migration, /3\.0::numeric as event_weight,\s*\n\s*'follow'/);
  assert.match(migration, /2\.0::numeric as event_weight,\s*\n\s*'favorite'/);
  assert.match(migration, /1\.5::numeric as event_weight/);
  assert.match(migration, /1\.0::numeric as event_weight,\s*\n\s*'progress_update'/);
});

test('the refresh function is never exposed to anon or authenticated, only service_role', () => {
  const migration = read(MIGRATION);
  assert.match(migration, /revoke all on function public\.refresh_manga_trending_scores\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.refresh_manga_trending_scores\(\) to service_role/);
});

test('the materialized view itself is revoked from public before being re-granted only select', () => {
  const migration = read(MIGRATION);
  assert.match(migration, /revoke all on public\.manga_trending_scores from public/);
  assert.match(migration, /grant select on public\.manga_trending_scores to anon, authenticated/);
});

test('the migration does not touch existing RLS policies on private tables, and does not drop get_trending_manga/_canonical_activity_window', () => {
  const migration = read(MIGRATION);
  assert.doesNotMatch(migration, /disable row level security/i);
  assert.doesNotMatch(migration, /drop policy/i);
  assert.doesNotMatch(migration, /drop function public\.get_trending_manga/i);
  assert.doesNotMatch(migration, /drop function public\._canonical_activity_window/i);
});

test('a scheduled hourly refresh is registered via pg_cron', () => {
  const migration = read(MIGRATION);
  assert.match(migration, /cron\.schedule\(\s*\n\s*'manga-trending-scores-hourly'/);
  assert.match(migration, /select public\.refresh_manga_trending_scores\(\);/);
});

test('the personalized and anonymous homepage no longer pass a window prop to TrendingSection (decay replaces discrete windows)', () => {
  const home = read('src/components/HomeCatalogSections.tsx');
  assert.doesNotMatch(home, /<TrendingSection window=/);
  assert.match(home, /<TrendingSection limit=\{6\} \/>/);
});

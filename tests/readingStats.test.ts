import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  activityLevel,
  CALENDAR_WEEKS,
  computeReadingStats,
  computeStreaks,
  isChapterFinished,
  localDayKey,
  startOfWeek,
  TREND_MONTHS,
  weeklyGoalProgress,
  type ReadingSession,
} from '../src/domain/readingStats.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Saturday 24 October 2026, 18:00 local time.
const now = new Date(2026, 9, 24, 18, 0);
const at = (month: number, day: number, hour = 20) => new Date(2026, month, day, hour, 0).toISOString();
const session = (mangaId: number, chapter: string, readAt: string, page = 19, total = 20): ReadingSession => ({
  canonical_manga_id: mangaId, canonical_chapter_key: chapter, page_index: page, total_pages: total, read_at: readAt,
});

test('a chapter is finished at 90% of its pages; unknown page counts never count as finished', () => {
  assert.equal(isChapterFinished({ page_index: 17, total_pages: 20 }), true);
  assert.equal(isChapterFinished({ page_index: 16, total_pages: 20 }), false);
  assert.equal(isChapterFinished({ page_index: 5, total_pages: 0 }), false);
});

test('days and weeks follow local time, weeks start on Monday', () => {
  assert.equal(localDayKey(new Date(2026, 9, 24, 23, 30)), '2026-10-24');
  assert.equal(localDayKey(startOfWeek(now)), '2026-10-19');
  assert.equal(localDayKey(startOfWeek(new Date(2026, 9, 19, 0, 5))), '2026-10-19');
  assert.equal(localDayKey(startOfWeek(new Date(2026, 9, 25, 12))), '2026-10-19');
});

test('streaks: the current run may end yesterday, the record is the longest run', () => {
  const days = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-22', '2026-10-23']);
  assert.deepEqual(computeStreaks(days, now), { current: 2, longest: 4 });
  assert.deepEqual(computeStreaks(new Set(['2026-10-21']), now), { current: 0, longest: 1 });
});

test('streaks run across month boundaries', () => {
  assert.equal(computeStreaks(new Set(['2026-09-30', '2026-10-01']), new Date(2026, 9, 1, 12)).current, 2);
});

test('re-reading a chapter counts it once; finishing date is the first finish', () => {
  const stats = computeReadingStats([
    session(1, '1', at(8, 10)),
    session(1, '1', at(9, 21)),
    session(1, '2', at(9, 21), 3),
  ], new Map(), now);
  assert.equal(stats.finishedChapters, 1);
  assert.equal(stats.monthly.find((point) => point.month === '2026-09')?.chapters, 1);
  assert.equal(stats.monthly.find((point) => point.month === '2026-10')?.chapters, 0);
  assert.equal(stats.seriesCount, 1);
  assert.equal(stats.activeDays, 2);
});

test('this week counts chapters first finished since Monday only', () => {
  const stats = computeReadingStats([
    session(1, '1', at(9, 18)),
    session(1, '2', at(9, 19, 9)),
    session(1, '3', at(9, 24, 10)),
    session(1, '4', at(9, 24, 10), 2),
  ], new Map(), now);
  assert.equal(stats.chaptersThisWeek, 2);
});

test('the calendar covers 12 full weeks ending with the current week, future days flagged', () => {
  const stats = computeReadingStats([session(1, '1', at(9, 22)), session(2, '9', at(9, 22))], new Map(), now);
  assert.equal(stats.calendar.length, CALENDAR_WEEKS);
  assert.ok(stats.calendar.every((week) => week.length === 7));
  const lastWeek = stats.calendar[CALENDAR_WEEKS - 1];
  assert.equal(lastWeek[0].day, '2026-10-19');
  assert.equal(lastWeek[3].count, 2);
  assert.equal(lastWeek[6].future, true);
  assert.equal(lastWeek[5].future, false);
});

test('monthly trend lists the last six months, oldest first', () => {
  const stats = computeReadingStats([], new Map(), now);
  assert.equal(stats.monthly.length, TREND_MONTHS);
  assert.deepEqual(stats.monthly.map((point) => point.month), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
});

test('top genres weigh series, not sessions, so one binge does not dominate', () => {
  const binge = Array.from({ length: 30 }, (_, index) => session(1, String(index), at(9, 20)));
  const stats = computeReadingStats(
    [...binge, session(2, '1', at(9, 20)), session(3, '1', at(9, 20))],
    new Map([[1, ['Action']], [2, ['Romance']], [3, ['Romance', 'Comedy']]]),
    now,
  );
  assert.deepEqual(stats.topGenres.slice(0, 2), [{ genre: 'Romance', series: 2 }, { genre: 'Action', series: 1 }]);
});

test('invalid dates are ignored instead of corrupting the stats', () => {
  assert.equal(computeReadingStats([session(1, '1', 'not-a-date')], new Map(), now).activeDays, 0);
});

test('activity levels use five sequential steps with 0 reserved for no reading', () => {
  assert.equal(activityLevel(0, 10), 0);
  assert.equal(activityLevel(1, 10), 1);
  assert.equal(activityLevel(10, 10), 4);
  assert.equal(activityLevel(3, 0), 0);
});

test('weekly goal progress is capped at 100% and reports what remains', () => {
  assert.deepEqual(weeklyGoalProgress(3, 5), { percent: 60, reached: false, remaining: 2 });
  assert.deepEqual(weeklyGoalProgress(7, 5), { percent: 100, reached: true, remaining: 0 });
  assert.deepEqual(weeklyGoalProgress(3, null), { percent: 0, reached: false, remaining: 0 });
});

test('stats read only the signed-in user history and keep the goal on the device', () => {
  const hook = read('src/hooks/useReadingStats.ts');
  assert.match(hook, /\.from\('user_reading_history'\)\s*\.select\('canonical_manga_id, canonical_chapter_key, page_index, total_pages, read_at'\)\s*\.eq\('user_id', user\.id\)/);
  assert.match(hook, /window\.localStorage\.setItem\(GOAL_STORAGE_KEY/);
  assert.match(read('src/App.tsx'), /path="\/stats" element=\{<Stats \/>\}/);
});

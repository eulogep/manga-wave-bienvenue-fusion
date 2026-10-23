/** One row of user_reading_history, reduced to what statistics need. */
export type ReadingSession = {
  canonical_manga_id: number;
  canonical_chapter_key: string;
  page_index: number;
  total_pages: number;
  read_at: string;
};

/** A chapter counts as finished once 90% of its pages were reached. */
export const CHAPTER_FINISHED_RATIO = 0.9;
export const CALENDAR_WEEKS = 12;
export const TREND_MONTHS = 6;
export const TOP_GENRES = 5;

export type CalendarDay = { day: string; count: number; future: boolean };
export type MonthlyPoint = { month: string; label: string; chapters: number };
export type GenreShare = { genre: string; series: number };

export type ReadingStats = {
  finishedChapters: number;
  seriesCount: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  chaptersThisWeek: number;
  /** CALENDAR_WEEKS columns of 7 days (Monday first), oldest week first. */
  calendar: CalendarDay[][];
  monthly: MonthlyPoint[];
  topGenres: GenreShare[];
};

const pad = (value: number) => String(value).padStart(2, '0');

/** Local calendar day, so a chapter read at 23:30 counts for that evening, not UTC's next day. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dayKeyToDate = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Monday of the local week containing `date`. */
export function startOfWeek(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
}

export function isChapterFinished(session: Pick<ReadingSession, 'page_index' | 'total_pages'>): boolean {
  if (session.total_pages <= 0) return false;
  return (session.page_index + 1) / session.total_pages >= CHAPTER_FINISHED_RATIO;
}

const chapterKey = (session: ReadingSession) => `${session.canonical_manga_id}:${session.canonical_chapter_key}`;

/** Longest run of consecutive days, and the run ending today (or yesterday, if today has no reading yet). */
export function computeStreaks(activeDayKeys: Set<string>, now: Date): { current: number; longest: number } {
  const sorted = [...activeDayKeys].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of sorted) {
    const date = dayKeyToDate(key);
    run = previous && localDayKey(addDays(previous, 1)) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  let cursor = activeDayKeys.has(localDayKey(now)) ? now : addDays(now, -1);
  let current = 0;
  while (activeDayKeys.has(localDayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { current, longest };
}

const monthLabel = (date: Date) => date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

export function computeReadingStats(
  sessions: ReadingSession[],
  genresByManga: Map<number, string[]>,
  now = new Date(),
): ReadingStats {
  // Chapters touched per day (any session), and first finish date per chapter.
  const chaptersByDay = new Map<string, Set<string>>();
  const firstFinish = new Map<string, Date>();
  const series = new Set<number>();

  for (const session of sessions) {
    const readAt = new Date(session.read_at);
    if (Number.isNaN(readAt.getTime())) continue;
    const key = chapterKey(session);
    const day = localDayKey(readAt);
    if (!chaptersByDay.has(day)) chaptersByDay.set(day, new Set());
    chaptersByDay.get(day)!.add(key);
    series.add(session.canonical_manga_id);
    if (isChapterFinished(session)) {
      const known = firstFinish.get(key);
      if (!known || readAt < known) firstFinish.set(key, readAt);
    }
  }

  const activeDays = new Set(chaptersByDay.keys());
  const { current, longest } = computeStreaks(activeDays, now);

  const weekStart = startOfWeek(now);
  const chaptersThisWeek = [...firstFinish.values()].filter((date) => date >= weekStart && date <= now).length;

  const today = localDayKey(now);
  const firstCalendarDay = addDays(weekStart, -7 * (CALENDAR_WEEKS - 1));
  const calendar: CalendarDay[][] = Array.from({ length: CALENDAR_WEEKS }, (_, week) => (
    Array.from({ length: 7 }, (_, weekday) => {
      const day = localDayKey(addDays(firstCalendarDay, week * 7 + weekday));
      return { day, count: chaptersByDay.get(day)?.size || 0, future: day > today };
    })
  ));

  const monthly: MonthlyPoint[] = Array.from({ length: TREND_MONTHS }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (TREND_MONTHS - 1 - index), 1);
    const month = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const chapters = [...firstFinish.values()].filter((finished) => (
      finished.getFullYear() === date.getFullYear() && finished.getMonth() === date.getMonth()
    )).length;
    return { month, label: monthLabel(date), chapters };
  });

  // Genres weigh series, not sessions: one binge must not outrank a varied month.
  const genreSeries = new Map<string, number>();
  for (const mangaId of series) {
    for (const genre of new Set(genresByManga.get(mangaId) || [])) {
      genreSeries.set(genre, (genreSeries.get(genre) || 0) + 1);
    }
  }
  const topGenres = [...genreSeries]
    .map(([genre, count]) => ({ genre, series: count }))
    .sort((left, right) => right.series - left.series || left.genre.localeCompare(right.genre, 'fr'))
    .slice(0, TOP_GENRES);

  return {
    finishedChapters: firstFinish.size,
    seriesCount: series.size,
    activeDays: activeDays.size,
    currentStreak: current,
    longestStreak: longest,
    chaptersThisWeek,
    calendar,
    monthly,
    topGenres,
  };
}

/** Five-step sequential bin for the activity calendar: 0 = no reading. */
export function activityLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as 1 | 2 | 3 | 4;
}

export const WEEKLY_GOAL_OPTIONS = [3, 5, 10, 20] as const;

export function weeklyGoalProgress(chaptersThisWeek: number, goal: number | null): { percent: number; reached: boolean; remaining: number } {
  if (!goal || goal <= 0) return { percent: 0, reached: false, remaining: 0 };
  return {
    percent: Math.min(100, Math.round((chaptersThisWeek / goal) * 100)),
    reached: chaptersThisWeek >= goal,
    remaining: Math.max(0, goal - chaptersThisWeek),
  };
}

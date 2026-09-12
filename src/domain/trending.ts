/**
 * T-3022 Trending — time-decayed, materialized, canonical aggregate.
 * Mirrors the SQL in
 * supabase/migrations/20260914090000_add_manga_trending_materialized_view.sql
 * (public.manga_trending_scores / public.refresh_manga_trending_scores).
 *
 * Trending is recent relative activity, never all-time popularity and never
 * mangas.views (that column is never incremented anywhere in the app — a
 * frozen seed number is not a real trend). Distinct from T-3023 Ranking
 * (public.get_manga_ranking), which favors sustained/repeat engagement over
 * a longer or all-time window; Trending favors what is moving *right now*.
 */

export type TrendingWindow = '24h' | '7d' | '30d';

/** Kept for the /trending page's window tabs, which filter the already-decayed materialized rows client-side by requiring at least one event within that recency band — the score itself always reflects the full 30-day decayed sum. */
export const TRENDING_WINDOW_DAYS: Record<TrendingWindow, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

export type TrendingEventKind = 'follow' | 'favorite' | 'reading_session' | 'progress_update';

export type RawActivityEvent = {
  canonicalMangaId: number;
  userId: string;
  occurredAt: string;
  kind: TrendingEventKind;
};

export type TrendingAggregate = {
  canonicalMangaId: number;
  uniqueUsers: number;
  followEvents: number;
  favoriteEvents: number;
  readingSessionEvents: number;
  progressUpdateEvents: number;
};

export type TrendingResult = TrendingAggregate & {
  score: number;
  rank: number;
};

/** Mirrors the SQL's per-event-kind weights. */
export const TRENDING_EVENT_WEIGHTS: Record<TrendingEventKind, number> = {
  follow: 3,
  favorite: 2,
  reading_session: 1.5,
  progress_update: 1,
};

/** Mirrors the SQL's tiered recency multiplier: 24h strongest, 7d medium, 30d weak, beyond 30d excluded. */
export function recencyMultiplier(occurredAt: Date, now: Date): number {
  const ageMs = now.getTime() - occurredAt.getTime();
  if (ageMs < 0) return 0;
  const day = 86_400_000;
  if (ageMs <= day) return 1;
  if (ageMs <= 7 * day) return 0.5;
  if (ageMs <= 30 * day) return 0.15;
  return 0;
}

/** Mirrors the SQL's per-(user, manga) reading-session cap before decay is applied. */
export const DEFAULT_MAX_SESSIONS_PER_USER = 5;

/**
 * Reference (non-SQL) aggregation used by unit tests to prove the scoring
 * model's properties (decay, unique-user weighting, per-user session cap,
 * canonical dedup, deterministic ties) independently of the database. The
 * materialized view is the source of truth in production; this function
 * must stay behaviorally equivalent.
 */
export function aggregateTrendingEvents(
  events: RawActivityEvent[],
  now: Date,
  maxSessionsPerUser = DEFAULT_MAX_SESSIONS_PER_USER,
): TrendingResult[] {
  const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
  const inWindow = events.filter((event) => {
    const occurredAt = new Date(event.occurredAt).getTime();
    return occurredAt <= now.getTime() && occurredAt >= thirtyDaysAgo;
  });

  // Cap reading_session events per (canonicalMangaId, user) to the most
  // recent N, exactly like the SQL's row_number()-based cap, before scoring.
  const sessionsByMangaUser = new Map<string, RawActivityEvent[]>();
  const nonSessionEvents: RawActivityEvent[] = [];
  for (const event of inWindow) {
    if (event.kind !== 'reading_session') {
      nonSessionEvents.push(event);
      continue;
    }
    const key = `${event.canonicalMangaId}:${event.userId}`;
    const list = sessionsByMangaUser.get(key) ?? [];
    list.push(event);
    sessionsByMangaUser.set(key, list);
  }
  const cappedSessionEvents = [...sessionsByMangaUser.values()].flatMap((sessions) => (
    [...sessions]
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
      .slice(0, maxSessionsPerUser)
  ));

  const scopedEvents = [...nonSessionEvents, ...cappedSessionEvents];

  const byManga = new Map<number, RawActivityEvent[]>();
  for (const event of scopedEvents) {
    const list = byManga.get(event.canonicalMangaId) ?? [];
    list.push(event);
    byManga.set(event.canonicalMangaId, list);
  }

  const aggregates: (TrendingAggregate & { score: number })[] = [...byManga.entries()].map(([canonicalMangaId, mangaEvents]) => {
    const users = new Set<string>();
    let score = 0;
    let followEvents = 0;
    let favoriteEvents = 0;
    let readingSessionEvents = 0;
    let progressUpdateEvents = 0;

    for (const event of mangaEvents) {
      users.add(event.userId);
      const multiplier = recencyMultiplier(new Date(event.occurredAt), now);
      score += TRENDING_EVENT_WEIGHTS[event.kind] * multiplier;
      if (event.kind === 'follow') followEvents += 1;
      else if (event.kind === 'favorite') favoriteEvents += 1;
      else if (event.kind === 'reading_session') readingSessionEvents += 1;
      else if (event.kind === 'progress_update') progressUpdateEvents += 1;
    }

    return {
      canonicalMangaId,
      uniqueUsers: users.size,
      followEvents,
      favoriteEvents,
      readingSessionEvents,
      progressUpdateEvents,
      score: Math.round(score * 10_000) / 10_000,
    };
  });

  return aggregates
    .filter((result) => result.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || right.uniqueUsers - left.uniqueUsers
      || left.canonicalMangaId - right.canonicalMangaId
    ))
    .map((result, index) => ({ ...result, rank: index + 1 }));
}

export type TrendingConfidence = {
  confident: boolean;
  qualifyingWorks: TrendingResult[];
};

/**
 * Minimum-sample protection: a manga clearing the SQL's `score > 0` floor can
 * still be a single isolated click. Require a slightly stronger combined
 * signal per work, and require enough qualifying works overall, before the
 * UI presents a ranked list — otherwise recent activity is too sparse to
 * mean anything and the UI must say so instead of fabricating a ranking.
 */
export function assessTrendingConfidence(
  results: TrendingResult[],
  options: { minSignalPerWork?: number; minQualifyingWorks?: number } = {},
): TrendingConfidence {
  const minSignalPerWork = options.minSignalPerWork ?? 2;
  const minQualifyingWorks = options.minQualifyingWorks ?? 3;

  const qualifyingWorks = results.filter((result) => (
    result.followEvents + result.favoriteEvents + result.readingSessionEvents + result.progressUpdateEvents >= minSignalPerWork
  ));

  return {
    confident: qualifyingWorks.length >= minQualifyingWorks,
    qualifyingWorks,
  };
}

const TREND_LABELS: Array<{ min: number; label: string }> = [
  { min: 25, label: 'Très lu cette semaine' },
  { min: 10, label: 'En hausse' },
  { min: 0, label: 'Nouveau signal' },
];

/** Human labels only — never render the raw numeric score to avoid false precision. */
export function trendingLabel(score: number): string {
  return (TREND_LABELS.find((tier) => score >= tier.min) ?? TREND_LABELS[TREND_LABELS.length - 1]).label;
}

/**
 * T-3022 Trending — pure scoring/confidence logic mirroring the SQL in
 * supabase/migrations/20260912090000_add_trending_manga_rpc.sql
 * (public.get_trending_manga). Kept here, tested, and documented so the
 * weighting formula is understandable and verifiable outside SQL, per the
 * ticket's requirement that scoring not be a black box.
 *
 * Trending is recent relative activity, never all-time popularity and never
 * mangas.views (that column is never incremented anywhere in the app — a
 * frozen seed number is not a real trend).
 */

export type TrendingWindow = '24h' | '7d' | '30d';

export const TRENDING_WINDOW_DAYS: Record<TrendingWindow, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
};

export type RawActivityEvent = {
  canonicalMangaId: number;
  userId: string;
  occurredAt: string;
  kind: 'reading_session' | 'follow' | 'favorite';
};

export type TrendingAggregate = {
  canonicalMangaId: number;
  uniqueReaders: number;
  readingSessions: number;
  newFollows: number;
  newFavorites: number;
};

export type TrendingResult = TrendingAggregate & {
  score: number;
  rank: number;
};

/** Mirrors the SQL weighting: unique reach > follow intent > favorite bookmark > raw session volume. */
export const TRENDING_WEIGHTS = {
  uniqueReader: 5,
  follow: 3,
  favorite: 2,
  readingSession: 1,
} as const;

/** Mirrors the SQL `least(sessions, max_sessions_per_user)` per-user cap. */
export const DEFAULT_MAX_SESSIONS_PER_USER = 5;

export function scoreTrendingAggregate(aggregate: TrendingAggregate): number {
  return (
    aggregate.uniqueReaders * TRENDING_WEIGHTS.uniqueReader
    + aggregate.newFollows * TRENDING_WEIGHTS.follow
    + aggregate.newFavorites * TRENDING_WEIGHTS.favorite
    + aggregate.readingSessions * TRENDING_WEIGHTS.readingSession
  );
}

/**
 * Reference (non-SQL) aggregation used by unit tests to prove the scoring
 * model's properties (recency, unique-user weighting, per-user cap,
 * canonical dedup) independently of the database. The RPC is the source of
 * truth in production; this function must stay behaviorally equivalent.
 */
export function aggregateTrendingEvents(
  events: RawActivityEvent[],
  windowStart: Date,
  now: Date,
  maxSessionsPerUser = DEFAULT_MAX_SESSIONS_PER_USER,
): TrendingResult[] {
  const inWindow = events.filter((event) => {
    const occurredAt = new Date(event.occurredAt).getTime();
    return occurredAt >= windowStart.getTime() && occurredAt <= now.getTime();
  });

  const byManga = new Map<number, RawActivityEvent[]>();
  for (const event of inWindow) {
    const list = byManga.get(event.canonicalMangaId) ?? [];
    list.push(event);
    byManga.set(event.canonicalMangaId, list);
  }

  const aggregates: TrendingAggregate[] = [...byManga.entries()].map(([canonicalMangaId, mangaEvents]) => {
    const readingByUser = new Map<string, number>();
    const readers = new Set<string>();
    let newFollows = 0;
    let newFavorites = 0;

    for (const event of mangaEvents) {
      if (event.kind === 'reading_session') {
        readers.add(event.userId);
        readingByUser.set(event.userId, (readingByUser.get(event.userId) ?? 0) + 1);
      } else if (event.kind === 'follow') {
        newFollows += 1;
      } else if (event.kind === 'favorite') {
        newFavorites += 1;
      }
    }

    const readingSessions = [...readingByUser.values()]
      .reduce((total, sessions) => total + Math.min(sessions, maxSessionsPerUser), 0);

    return {
      canonicalMangaId,
      uniqueReaders: readers.size,
      readingSessions,
      newFollows,
      newFavorites,
    };
  });

  return aggregates
    .map((aggregate) => ({ ...aggregate, score: scoreTrendingAggregate(aggregate), rank: 0 }))
    .filter((result) => result.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || right.uniqueReaders - left.uniqueReaders
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
    result.uniqueReaders + result.newFollows + result.newFavorites >= minSignalPerWork
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

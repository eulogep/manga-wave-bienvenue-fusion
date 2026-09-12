/**
 * T-3023 Ranking — broader sustained popularity, distinct from T-3022
 * Trending (recent acceleration). Mirrors the SQL in
 * supabase/migrations/20260913090000_add_manga_ranking_rpc.sql
 * (public.get_manga_ranking / public._canonical_activity_window).
 *
 * Never uses mangas.rating: audited before writing this file — 145/343
 * production rows are exactly 4.8, 36 are exactly 4.9, both provider-scraper
 * hardcoded constants (see server/src/sources/originmanga.ts,
 * crunchyscan.ts, mangafire.ts), not a real per-title quality signal.
 *
 * mangas.views is never part of the real score. It exists here only as an
 * explicitly flagged `legacyFallback` entry, used solely to fill slots real
 * activity cannot, and must always be rendered distinctly by the UI.
 */

export type RankingWindow = '24h' | '7d' | '30d' | 'all';

export const RANKING_WINDOW_DAYS: Record<RankingWindow, number | null> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  all: null,
};

export type RankingActivityEvent = {
  canonicalMangaId: number;
  userId: string;
  occurredAt: string;
  kind: 'reading_session' | 'follow' | 'favorite';
};

export type RankingAggregate = {
  canonicalMangaId: number;
  uniqueReaders: number;
  readingSessions: number;
  distinctActiveDays: number;
  newFollows: number;
  newFavorites: number;
};

export type RankingResult = RankingAggregate & {
  score: number;
  legacyFallback: boolean;
  rank: number;
};

/** Repeat readership (distinct active days) is weighted highest — the property that most separates sustained Ranking from a Trending spike. */
export const RANKING_WEIGHTS = {
  distinctActiveDay: 6,
  uniqueReader: 4,
  follow: 3,
  favorite: 2,
  readingSession: 1,
} as const;

export const DEFAULT_MAX_SESSIONS_PER_USER = 5;

export function scoreRankingAggregate(aggregate: RankingAggregate): number {
  return (
    aggregate.distinctActiveDays * RANKING_WEIGHTS.distinctActiveDay
    + aggregate.uniqueReaders * RANKING_WEIGHTS.uniqueReader
    + aggregate.newFollows * RANKING_WEIGHTS.follow
    + aggregate.newFavorites * RANKING_WEIGHTS.favorite
    + aggregate.readingSessions * RANKING_WEIGHTS.readingSession
  );
}

/**
 * Reference (non-SQL) aggregation used by unit tests to prove the scoring
 * model's properties independently of the database. The RPC is the source
 * of truth in production; this function must stay behaviorally equivalent.
 */
export function aggregateRankingEvents(
  events: RankingActivityEvent[],
  windowStart: Date | null,
  now: Date,
  maxSessionsPerUser = DEFAULT_MAX_SESSIONS_PER_USER,
): RankingResult[] {
  const inWindow = events.filter((event) => {
    const occurredAt = new Date(event.occurredAt).getTime();
    if (occurredAt > now.getTime()) return false;
    if (windowStart === null) return true;
    return occurredAt >= windowStart.getTime();
  });

  const byManga = new Map<number, RankingActivityEvent[]>();
  for (const event of inWindow) {
    const list = byManga.get(event.canonicalMangaId) ?? [];
    list.push(event);
    byManga.set(event.canonicalMangaId, list);
  }

  const aggregates: RankingAggregate[] = [...byManga.entries()].map(([canonicalMangaId, mangaEvents]) => {
    const sessionsByUser = new Map<string, number>();
    const activeDaysByUser = new Map<string, Set<string>>();
    let newFollows = 0;
    let newFavorites = 0;

    for (const event of mangaEvents) {
      if (event.kind === 'reading_session') {
        sessionsByUser.set(event.userId, (sessionsByUser.get(event.userId) ?? 0) + 1);
        const day = new Date(event.occurredAt).toISOString().slice(0, 10);
        const days = activeDaysByUser.get(event.userId) ?? new Set<string>();
        days.add(day);
        activeDaysByUser.set(event.userId, days);
      } else if (event.kind === 'follow') {
        newFollows += 1;
      } else if (event.kind === 'favorite') {
        newFavorites += 1;
      }
    }

    const readingSessions = [...sessionsByUser.values()]
      .reduce((total, sessions) => total + Math.min(sessions, maxSessionsPerUser), 0);
    const distinctActiveDays = [...activeDaysByUser.values()]
      .reduce((total, days) => total + Math.min(days.size, maxSessionsPerUser), 0);

    return {
      canonicalMangaId,
      uniqueReaders: sessionsByUser.size,
      readingSessions,
      distinctActiveDays,
      newFollows,
      newFavorites,
    };
  });

  return aggregates
    .map((aggregate) => ({
      ...aggregate,
      score: scoreRankingAggregate(aggregate),
      legacyFallback: false,
      rank: 0,
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || right.uniqueReaders - left.uniqueReaders
      || left.canonicalMangaId - right.canonicalMangaId
    ))
    .map((result, index) => ({ ...result, rank: index + 1 }));
}

/**
 * Reference model for the legacy-fallback merge: real ranked results first,
 * then (only if allowed and needed) works ordered by the frozen `views`
 * field, explicitly flagged so the UI never blends them into "real" ranking.
 */
export function mergeWithLegacyFallback(
  realResults: RankingResult[],
  legacyCandidates: Array<{ canonicalMangaId: number; views: number }>,
  resultLimit: number,
  includeLegacyFallback = true,
): RankingResult[] {
  const rankedIds = new Set(realResults.map((result) => result.canonicalMangaId));
  const needed = Math.max(0, resultLimit - realResults.length);

  const legacyRows: RankingResult[] = includeLegacyFallback && needed > 0
    ? [...legacyCandidates]
      .filter((candidate) => candidate.views > 0 && !rankedIds.has(candidate.canonicalMangaId))
      .sort((left, right) => right.views - left.views || left.canonicalMangaId - right.canonicalMangaId)
      .slice(0, needed)
      .map((candidate) => ({
        canonicalMangaId: candidate.canonicalMangaId,
        uniqueReaders: 0,
        readingSessions: 0,
        distinctActiveDays: 0,
        newFollows: 0,
        newFavorites: 0,
        score: candidate.views,
        legacyFallback: true,
        rank: 0,
      }))
    : [];

  return [...realResults, ...legacyRows]
    .slice(0, resultLimit)
    .map((result, index) => ({ ...result, rank: index + 1 }));
}

export type RankingConfidence = {
  confident: boolean;
  qualifyingWorks: RankingResult[];
};

/** Same minimum-sample philosophy as Trending: legacy-fallback rows never count toward confidence. */
export function assessRankingConfidence(
  results: RankingResult[],
  options: { minSignalPerWork?: number; minQualifyingWorks?: number } = {},
): RankingConfidence {
  const minSignalPerWork = options.minSignalPerWork ?? 2;
  const minQualifyingWorks = options.minQualifyingWorks ?? 3;

  const qualifyingWorks = results.filter((result) => (
    !result.legacyFallback
    && result.distinctActiveDays + result.uniqueReaders + result.newFollows + result.newFavorites >= minSignalPerWork
  ));

  return {
    confident: qualifyingWorks.length >= minQualifyingWorks,
    qualifyingWorks,
  };
}

const RANK_LABELS: Array<{ min: number; label: string }> = [
  { min: 40, label: 'Valeur sûre' },
  { min: 15, label: 'Très suivi' },
  { min: 0, label: 'Populaire' },
];

/** Human labels only — never render the raw numeric score. */
export function rankingLabel(result: Pick<RankingResult, 'score' | 'legacyFallback'>): string {
  if (result.legacyFallback) return 'Populaire (historique)';
  return (RANK_LABELS.find((tier) => result.score >= tier.min) ?? RANK_LABELS[RANK_LABELS.length - 1]).label;
}

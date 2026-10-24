import { normalizeQuery, type SearchWork } from './canonicalSearch.ts';

/**
 * "Pour toi" feed — a small, explainable cousin of the TikTok / Instagram
 * recommendation pipeline, sized for a few hundred canonical works:
 *
 *   1. signals    what the reader did (reads, follows, favorites, lists, feed
 *                 likes/opens) and rejected (dismissals, cards skipped), decayed
 *                 with a 30-day half-life;
 *   2. profile    genre / format / author affinities derived from those signals;
 *   3. scoring    affinity + community popularity + freshness + quality − fatigue;
 *   4. re-ranking diversity (no genre/author streaks) and one exploration slot
 *                 in five, so the feed never collapses into a filter bubble.
 *
 * Everything runs in the browser on data the reader already owns; nothing here
 * is sent anywhere. Pure and deterministic for a given seed, hence testable.
 */

export type FeedSignalKind =
  | 'chapter_finished'
  | 'reading_session'
  | 'follow'
  | 'favorite'
  | 'list_to_read'
  | 'list_completed'
  | 'list_custom'
  | 'feed_like'
  | 'feed_open'
  | 'dismiss'
  | 'feed_skip';

export type FeedSignal = { mangaId: number; kind: FeedSignalKind; at: string };

/** Positive = interest, negative = rejection. A dismissal outweighs a casual read. */
export const SIGNAL_WEIGHTS: Record<FeedSignalKind, number> = {
  chapter_finished: 1,
  reading_session: 0.4,
  follow: 4,
  favorite: 5,
  list_to_read: 2,
  list_completed: 3,
  list_custom: 2,
  feed_like: 3,
  feed_open: 1.5,
  dismiss: -6,
  feed_skip: -0.35,
};

export const SIGNAL_HALF_LIFE_DAYS = 30;
/** Reading the same title for weeks must not drown every other interest. */
const MAX_READ_SIGNALS_PER_WORK = 6;
export const EXPLORATION_EVERY = 5;
const DAY_MS = 86_400_000;

export type TasteProfile = {
  genres: Map<string, number>;
  types: Map<string, number>;
  authors: Map<string, number>;
  /** Net engagement per work (after decay), positive or negative. */
  engagement: Map<number, number>;
  /** Total positive engagement; 0 means cold start. */
  strength: number;
};

export type FeedReason =
  | { kind: 'because_you_read'; anchorTitle: string }
  | { kind: 'genre'; genre: string }
  | { kind: 'author' }
  | { kind: 'trending' }
  | { kind: 'fresh' }
  | { kind: 'explore' }
  | { kind: 'popular' };

export type FeedItem = { work: SearchWork; score: number; reason: FeedReason };

export type FeedContext = {
  catalog: SearchWork[];
  signals: FeedSignal[];
  /** Community trending score per canonical id (any non-negative scale). */
  trending: Map<number, number>;
  /** Genres picked during onboarding; seed a cold profile. */
  onboardingGenres?: string[];
  /** Cards already shown without engagement, per canonical id. */
  impressions?: Map<number, number>;
  now?: Date;
  seed?: number;
};

const decay = (at: string, now: Date) => {
  const time = Date.parse(at);
  if (Number.isNaN(time)) return 0;
  const ageDays = Math.max(0, (now.getTime() - time) / DAY_MS);
  return 0.5 ** (ageDays / SIGNAL_HALF_LIFE_DAYS);
};

const workIdentity = (work: Pick<SearchWork, 'title' | 'author'>) => `${normalizeQuery(work.title)}|${normalizeQuery(work.author || '')}`;
const isAdult = (work: SearchWork) => work.content_rating === 'erotica' || work.genre.includes('Smut');

const addTo = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) || 0) + value);

/** Normalizes positive affinities to [0, 1] and keeps negatives proportionally. */
const normalizeAffinity = (map: Map<string, number>) => {
  const max = Math.max(0, ...map.values());
  if (max === 0) return map;
  return new Map([...map].map(([key, value]) => [key, Math.max(-1, value / max)]));
};

export function buildTasteProfile(
  catalog: SearchWork[],
  signals: FeedSignal[],
  onboardingGenres: string[] = [],
  now = new Date(),
): TasteProfile {
  const byId = new Map(catalog.map((work) => [work.id, work]));
  const engagement = new Map<number, number>();
  const readCount = new Map<number, number>();

  for (const signal of signals) {
    if (signal.kind === 'chapter_finished' || signal.kind === 'reading_session') {
      const count = (readCount.get(signal.mangaId) || 0) + 1;
      readCount.set(signal.mangaId, count);
      if (count > MAX_READ_SIGNALS_PER_WORK) continue;
    }
    const value = SIGNAL_WEIGHTS[signal.kind] * decay(signal.at, now);
    engagement.set(signal.mangaId, (engagement.get(signal.mangaId) || 0) + value);
  }

  const genres = new Map<string, number>();
  const types = new Map<string, number>();
  const authors = new Map<string, number>();
  let strength = 0;

  for (const [mangaId, value] of engagement) {
    const work = byId.get(mangaId);
    if (!work || value === 0) continue;
    if (value > 0) strength += value;
    // Spread over genres so a work tagged with eight genres does not count eight times.
    const share = work.genre.length ? value / Math.sqrt(work.genre.length) : 0;
    for (const genre of work.genre) addTo(genres, genre, share);
    if (work.manga_type) addTo(types, work.manga_type, value);
    if (work.author) addTo(authors, normalizeQuery(work.author), value);
  }

  // Onboarding picks behave like a light, non-decaying favorite per genre.
  for (const genre of onboardingGenres) addTo(genres, genre, SIGNAL_WEIGHTS.list_to_read);

  return {
    genres: normalizeAffinity(genres),
    types: normalizeAffinity(types),
    authors: normalizeAffinity(authors),
    engagement,
    strength,
  };
}

/** How well a work matches the profile, in [-1, 1]. */
export function affinityScore(work: SearchWork, profile: TasteProfile): number {
  const genreValues = work.genre.map((genre) => profile.genres.get(genre) || 0);
  // Best genre counts most: a reader who loves isekai likes isekai-action too.
  const genrePart = genreValues.length
    ? 0.7 * Math.max(...genreValues) + 0.3 * (genreValues.reduce((sum, value) => sum + value, 0) / genreValues.length)
    : 0;
  const typePart = work.manga_type ? profile.types.get(work.manga_type) || 0 : 0;
  const authorPart = work.author ? profile.authors.get(normalizeQuery(work.author)) || 0 : 0;
  return Math.max(-1, Math.min(1, 0.65 * genrePart + 0.15 * typePart + 0.2 * authorPart));
}

/** Small seeded PRNG (mulberry32) so a feed is stable for a day yet varies on refresh. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function dailySeed(date: Date, refresh = 0): number {
  return Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`) * 31 + refresh;
}

type Scored = {
  work: SearchWork;
  score: number;
  affinity: number;
  popularity: number;
  freshness: number;
  explore: boolean;
};

/** Share of genres two works have in common, relative to the smaller set (0..1). */
export function genreOverlap(left: SearchWork, right: SearchWork): number {
  if (!left.genre.length || !right.genre.length) return 0;
  const shared = left.genre.filter((genre) => right.genre.includes(genre)).length;
  return shared / Math.min(left.genre.length, right.genre.length);
}

function chooseReason(entry: Scored, profile: TasteProfile, anchors: SearchWork[], coldStart: boolean): FeedReason {
  if (entry.explore) return { kind: 'explore' };
  if (!coldStart && entry.affinity > 0.25) {
    const authorKey = entry.work.author ? normalizeQuery(entry.work.author) : '';
    if (authorKey && (profile.authors.get(authorKey) || 0) > 0.5) return { kind: 'author' };
    // "Because you read X": the engaged work sharing the most genres.
    let best: { work: SearchWork; shared: number } | null = null;
    for (const anchor of anchors) {
      const shared = anchor.genre.filter((genre) => entry.work.genre.includes(genre)).length;
      if (shared >= 2 && (!best || shared > best.shared)) best = { work: anchor, shared };
    }
    if (best) return { kind: 'because_you_read', anchorTitle: best.work.title };
    const genre = [...entry.work.genre].sort((left, right) => (profile.genres.get(right) || 0) - (profile.genres.get(left) || 0))[0];
    if (genre && (profile.genres.get(genre) || 0) > 0) return { kind: 'genre', genre };
  }
  if (entry.popularity >= 0.5) return { kind: 'trending' };
  if (entry.freshness >= 0.5) return { kind: 'fresh' };
  return { kind: 'popular' };
}

export function buildForYouFeed(context: FeedContext): FeedItem[] {
  const now = context.now ?? new Date();
  const random = seededRandom(context.seed ?? dailySeed(now));
  const profile = buildTasteProfile(context.catalog, context.signals, context.onboardingGenres, now);
  // Picked onboarding genres are enough to personalize, even before any reading.
  const coldStart = profile.strength < 3 && !context.onboardingGenres?.length;

  // Known works (positive engagement) and explicit dismissals never re-enter the feed.
  // A skipped card is not a rejection: it only lowers affinity and adds fatigue.
  const dismissed = new Set(context.signals.filter((signal) => signal.kind === 'dismiss').map((signal) => signal.mangaId));
  const excluded = new Set([...profile.engagement].filter(([, value]) => value > 0).map(([id]) => id));
  for (const id of dismissed) excluded.add(id);
  const knownIdentities = new Set(context.catalog.filter((work) => excluded.has(work.id)).map(workIdentity));
  const anchors = context.catalog
    .filter((work) => (profile.engagement.get(work.id) || 0) > 0)
    .sort((left, right) => (profile.engagement.get(right.id) || 0) - (profile.engagement.get(left.id) || 0))
    .slice(0, 12);

  const maxTrending = Math.max(0, ...context.trending.values());
  const maxViews = Math.max(1, ...context.catalog.map((work) => work.views || 0));
  const maxRating = Math.max(1, ...context.catalog.map((work) => work.rating || 0));

  const seen = new Set<string>();
  const candidates: Scored[] = [];
  for (const work of context.catalog) {
    const identity = workIdentity(work);
    if (excluded.has(work.id) || knownIdentities.has(identity) || isAdult(work) || seen.has(identity)) continue;
    seen.add(identity);

    const affinity = coldStart ? 0 : affinityScore(work, profile);
    const trendingPart = maxTrending > 0 ? (context.trending.get(work.id) || 0) / maxTrending : 0;
    const popularity = Math.max(trendingPart, 0.5 * Math.sqrt((work.views || 0) / maxViews));
    const ageDays = (now.getTime() - (Date.parse(work.created_at) || 0)) / DAY_MS;
    const freshness = ageDays >= 0 && ageDays < 30 ? 1 - ageDays / 30 : 0;
    const quality = work.rating ? work.rating / maxRating : 0.5;
    const fatigue = 0.12 * Math.min(4, context.impressions?.get(work.id) || 0);
    const jitter = random() * 0.06;

    const score = coldStart
      ? 0.45 * popularity + 0.25 * quality + 0.2 * freshness + 0.1 * random() - fatigue
      : 0.55 * affinity + 0.2 * popularity + 0.1 * freshness + 0.15 * quality - fatigue + jitter;
    candidates.push({ work, score, affinity, popularity, freshness, explore: false });
  }

  // Exploration pool: genres the reader has not shown interest in yet.
  const isUnexplored = (entry: Scored) => entry.work.genre.length > 0
    && entry.work.genre.every((genre) => (profile.genres.get(genre) || 0) <= 0.05);

  const topTastes = [...profile.genres].filter(([, value]) => value >= 0.5).sort((left, right) => right[1] - left[1]).slice(0, 3).map(([genre]) => genre);

  const remaining = [...candidates].sort((left, right) => right.score - left.score || left.work.id - right.work.id);
  const feed: Scored[] = [];
  const authorCount = new Map<string, number>();

  while (remaining.length) {
    const position = feed.length;
    const wantExplore = !coldStart && position % EXPLORATION_EVERY === EXPLORATION_EVERY - 1;
    const recent = feed.slice(-3);

    let bestIndex = -1;
    let bestValue = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const entry = remaining[index];
      if (wantExplore && !isUnexplored(entry)) continue;
      const author = entry.work.author ? normalizeQuery(entry.work.author) : '';
      // Diversity: no genre streaks, no author repeats, no long same-format runs.
      let penalty = recent.reduce((sum, other) => sum + 0.15 * genreOverlap(other.work, entry.work), 0);
      // Taste coverage: a main taste missing from the last cards earns its turn,
      // so "isekai + romance" alternates while a single taste is not diluted.
      if (entry.work.genre.some((genre) => topTastes.includes(genre) && !recent.some((other) => other.work.genre.includes(genre)))) {
        penalty -= 0.15;
      }
      if (author) penalty += 0.3 * (authorCount.get(author) || 0);
      if (recent.length === 3 && recent.every((other) => other.work.manga_type === entry.work.manga_type)) penalty += 0.08;
      const base = wantExplore ? entry.popularity * 0.5 + random() * 0.5 : entry.score;
      const value = base - penalty;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
      // The list is sorted by score: past the top few, nothing can beat the best anymore.
      if (!wantExplore && index > 40) break;
    }
    if (bestIndex === -1) bestIndex = 0; // No unexplored work left: fall back to the best match.

    const [picked] = remaining.splice(bestIndex, 1);
    picked.explore = wantExplore && isUnexplored(picked);
    const author = picked.work.author ? normalizeQuery(picked.work.author) : '';
    if (author) authorCount.set(author, (authorCount.get(author) || 0) + 1);
    feed.push(picked);
  }

  return feed.map((entry) => ({ work: entry.work, score: entry.score, reason: chooseReason(entry, profile, anchors, coldStart) }));
}

export function feedReasonLabel(reason: FeedReason, genreLabel: (genre: string) => string = (genre) => genre): string {
  switch (reason.kind) {
    case 'because_you_read': return `Parce que tu as lu ${reason.anchorTitle}`;
    case 'genre': return `Parce que tu aimes : ${genreLabel(reason.genre)}`;
    case 'author': return 'Un auteur que tu lis déjà';
    case 'trending': return 'Tendance en ce moment';
    case 'fresh': return 'Nouveau dans le catalogue';
    case 'explore': return 'Pour sortir de tes habitudes';
    case 'popular':
    default: return 'Populaire sur Manga Wave';
  }
}

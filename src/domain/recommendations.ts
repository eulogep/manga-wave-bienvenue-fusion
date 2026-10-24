/**
 * T-3024 Recommendations — content-based "similar works" and a small,
 * additive correctness fix to the existing personalized-homepage affinity
 * pool (see homePersonalization.ts).
 *
 * Scope decision (see MANGA_WAVE_V3_T3024_REPORT.md for the full write-up):
 * this deliberately does NOT build collaborative filtering (co-favorite /
 * co-follow "users who liked X also liked Y") in this pass. Real
 * cross-user engagement volume in production is still negligible (T-3022/
 * T-3023 already established this), so any such signal would be
 * PASS_WITH_INSUFFICIENT_ORGANIC_ACTIVITY today — the same honest
 * limitation, without adding new infrastructure to carry it. Content-based
 * similarity, by contrast, works today for every catalog work regardless of
 * activity volume, because it is grounded entirely in T-3020's already
 * audited-trustworthy canonical metadata (genres, author, type) — never
 * mangas.rating (audited in T-3023 as mostly provider-hardcoded constants)
 * and never mangas.views (dead, never incremented).
 */

import { normalizeQuery } from './canonicalSearch.ts';

export type SimilarityCandidate = {
  id: number;
  title: string;
  author: string | null;
  genre: string[];
  manga_type: string | null;
  status: string;
  content_rating?: string | null;
};

export type SimilarWorkResult = {
  canonicalMangaId: number;
  score: number;
  sharedGenres: string[];
  sameAuthor: boolean;
  sameType: boolean;
};

/** A shared genre matters most (it's the strongest real, audited signal); a shared, named author is a strong secondary signal; matching format is a light tie-breaker only. */
export const SIMILARITY_WEIGHTS = {
  sharedGenre: 2,
  sameAuthor: 3,
  sameType: 1,
} as const;

const normalizedSet = (values: string[]): Set<string> => new Set(values.map((value) => normalizeQuery(value)).filter(Boolean));
const isAdultCandidate = (work: SimilarityCandidate) => work.content_rating === 'erotica' || work.genre.includes('Smut');
const workIdentity = (work: SimilarityCandidate) => `${normalizeQuery(work.title)}|${normalizeQuery(work.author || '')}`;

/**
 * Pure, deterministic content-based similarity over already-cached canonical
 * metadata (the same T-3020 snapshot Search/Command Search/Trending/Ranking
 * already share) — no extra query, no per-provider call, no user data of
 * any kind. Excludes the target itself and anything scoring zero (no
 * fabricated "similar" result when nothing genuinely overlaps).
 */
export function findSimilarWorks(
  target: SimilarityCandidate,
  catalog: SimilarityCandidate[],
  limit = 8,
  options: { excludeIds?: ReadonlySet<number> } = {},
): SimilarWorkResult[] {
  const targetGenres = normalizedSet(target.genre);
  const targetAuthor = target.author ? normalizeQuery(target.author) : '';
  const targetIdentity = workIdentity(target);
  // Explicit works are only suggested next to an explicit work: these cards are not blurred.
  const allowAdult = isAdultCandidate(target);
  const seen = new Set<string>([targetIdentity]);
  const byId = new Map(catalog.map((work) => [work.id, work]));

  return catalog
    .filter((candidate) => (
      candidate.id !== target.id
      && !options.excludeIds?.has(candidate.id)
      && (allowAdult || !isAdultCandidate(candidate))
      && normalizeQuery(candidate.title) !== normalizeQuery(target.title)
    ))
    .map((candidate) => {
      const sharedGenres = candidate.genre.filter((genre) => targetGenres.has(normalizeQuery(genre)));
      const sameAuthor = Boolean(targetAuthor && candidate.author && normalizeQuery(candidate.author) === targetAuthor);
      const sameType = Boolean(target.manga_type && candidate.manga_type && candidate.manga_type === target.manga_type);
      const score = (
        sharedGenres.length * SIMILARITY_WEIGHTS.sharedGenre
        + (sameAuthor ? SIMILARITY_WEIGHTS.sameAuthor : 0)
        + (sameType ? SIMILARITY_WEIGHTS.sameType : 0)
      );
      return { canonicalMangaId: candidate.id, score, sharedGenres, sameAuthor, sameType };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || right.sharedGenres.length - left.sharedGenres.length
      || left.canonicalMangaId - right.canonicalMangaId
    ))
    // Display-only: the same work imported from several sources is suggested once.
    .filter((result) => {
      const identity = workIdentity(byId.get(result.canonicalMangaId)!);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .slice(0, Math.max(0, limit));
}

/** Short French reason shown under a suggestion: author first, then up to two shared genres. */
export function explainSimilarity(result: SimilarWorkResult, label: (genre: string) => string = (genre) => genre): string {
  const parts: string[] = [];
  if (result.sameAuthor) parts.push('Même auteur');
  if (result.sharedGenres.length) parts.push(result.sharedGenres.slice(0, 2).map(label).join(' · '));
  if (parts.length === 0 && result.sameType) parts.push('Même format');
  return parts.join(' · ');
}

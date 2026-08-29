import { normalizeMangaTitle } from './canonicalManga.ts';

export type RelevanceCandidate = {
  title: string;
  aliases?: string[];
};

export function mangaSearchRelevance(query: string, candidate: RelevanceCandidate): number {
  const normalizedQuery = normalizeMangaTitle(query);
  if (!normalizedQuery) return 0;

  const queryTokens = normalizedQuery.split(' ');
  const identities = [candidate.title, ...(candidate.aliases || [])]
    .map(normalizeMangaTitle)
    .filter(Boolean);

  return identities.reduce((best, identity) => {
    if (identity === normalizedQuery) return 1;
    if (identity.startsWith(`${normalizedQuery} `) || identity.endsWith(` ${normalizedQuery}`)) {
      return Math.max(best, 0.92);
    }
    const tokens = new Set(identity.split(' '));
    const matched = queryTokens.filter((token) => tokens.has(token)).length;
    const queryCoverage = matched / queryTokens.length;
    const titlePrecision = matched / Math.max(tokens.size, 1);
    return Math.max(best, queryCoverage * 0.7 + titlePrecision * 0.3);
  }, 0);
}

export function filterRelevantMangaResults<T extends RelevanceCandidate>(query: string, results: T[]): T[] {
  return results.filter((result) => mangaSearchRelevance(query, result) >= 0.78);
}

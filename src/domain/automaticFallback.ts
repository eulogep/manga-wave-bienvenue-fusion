export type AutomaticFallbackCandidate<TChapter = unknown> = {
  source: string;
  chapter: TChapter | null;
  sourceScore: number;
};

export const MAX_AUTOMATIC_SOURCE_ATTEMPTS = 3;

export function parseTriedSources(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((source) => source.trim()).filter(Boolean))];
}

export function selectAutomaticFallback<T extends AutomaticFallbackCandidate>(
  candidates: T[],
  currentSource: string,
  previouslyTried: string[],
  maximumAttempts = MAX_AUTOMATIC_SOURCE_ATTEMPTS,
): T | null {
  const tried = new Set([...previouslyTried, currentSource]);
  if (tried.size >= maximumAttempts) return null;

  return [...candidates]
    .filter((candidate) => candidate.chapter && !tried.has(candidate.source))
    .sort((left, right) => right.sourceScore - left.sourceScore || left.source.localeCompare(right.source))[0]
    ?? null;
}

export function appendTriedSource(previouslyTried: string[], source: string): string[] {
  return [...new Set([...previouslyTried, source])];
}

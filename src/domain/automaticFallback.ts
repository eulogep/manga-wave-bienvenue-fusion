export type AutomaticFallbackCandidate<TChapter = unknown> = {
  source: string;
  chapter: TChapter | null;
  sourceScore: number;
  language?: string;
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
  preferredLanguage?: string,
): T | null {
  const tried = new Set([...previouslyTried, currentSource]);
  if (tried.size >= maximumAttempts) return null;

  const eligible = [...candidates]
    .filter((candidate) => candidate.chapter && !tried.has(candidate.source));
  const preferredBase = preferredLanguage?.trim().toLowerCase().split(/[-_]/)[0];
  const sameLanguage = preferredBase
    ? eligible.filter((candidate) => candidate.language?.trim().toLowerCase().split(/[-_]/)[0] === preferredBase)
    : [];
  const rankedPool = sameLanguage.length > 0 ? sameLanguage : eligible;

  return rankedPool
    .sort((left, right) => right.sourceScore - left.sourceScore || left.source.localeCompare(right.source))[0]
    ?? null;
}

export function appendTriedSource(previouslyTried: string[], source: string): string[] {
  return [...new Set([...previouslyTried, source])];
}

export function buildFallbackNotice(input: {
  previousSource: string;
  nextSource: string;
  previousLanguage: string;
  nextLanguage: string;
}): string {
  const previousBase = input.previousLanguage.trim().toLowerCase().split(/[-_]/)[0];
  const nextBase = input.nextLanguage.trim().toLowerCase().split(/[-_]/)[0];
  if (previousBase && nextBase && previousBase !== nextBase) {
    return `${input.previousSource} est indisponible. Passage temporaire de ${input.previousLanguage.toUpperCase()} à ${input.nextLanguage.toUpperCase()} via ${input.nextSource}.`;
  }
  return `${input.previousSource} est indisponible. Lecture poursuivie via ${input.nextSource}.`;
}

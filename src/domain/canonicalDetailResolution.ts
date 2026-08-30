export type CanonicalDetailCandidate = {
  sourceId: string;
  sourceMangaId: string;
  eligible: boolean;
  sourceScore: number;
};

export type ResolvedCanonicalDetail<T> = {
  candidate: CanonicalDetailCandidate;
  value: T;
  attemptedSources: string[];
};

export async function resolveCanonicalDetail<T>(
  candidates: CanonicalDetailCandidate[],
  load: (candidate: CanonicalDetailCandidate) => Promise<T>,
  attemptLimit = 4,
): Promise<ResolvedCanonicalDetail<T>> {
  const attemptedSources: string[] = [];
  const ranked = candidates
    .filter((candidate) => candidate.eligible)
    .sort((left, right) => right.sourceScore - left.sourceScore || left.sourceId.localeCompare(right.sourceId))
    .slice(0, Math.max(1, attemptLimit));

  for (const candidate of ranked) {
    attemptedSources.push(candidate.sourceId);
    try {
      return { candidate, value: await load(candidate), attemptedSources };
    } catch {
      // Continue with the next healthy canonical mapping.
    }
  }

  throw new Error(
    attemptedSources.length > 0
      ? 'Aucune édition compatible ne peut être chargée pour le moment.'
      : 'Aucune édition lisible n’est disponible pour ce manga.',
  );
}

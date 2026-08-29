export type CanonicalSourceMapping = {
  provider: string;
  externalId: string;
  title: string;
  language: string;
  available: boolean;
  readable: boolean;
  url: string | null;
  detailUrl: string | null;
};

export type CanonicalManga = {
  canonicalId: string;
  normalizedTitle: string;
  title: string;
  alternativeTitles: string[];
  author: string | null;
  type: string | null;
  status: string | null;
  cover: string | null;
  genres: string[];
  rating: number | null;
  sources: CanonicalSourceMapping[];
};

export type CanonicalMangaCandidate = {
  provider: string;
  externalId: string;
  title: string;
  alternativeTitles?: string[];
  author?: string | null;
  type?: string | null;
  status?: string | null;
  cover?: string | null;
  genres?: string[];
  rating?: number | null;
  language?: string | null;
  available?: boolean;
  readable?: boolean;
  url?: string | null;
  detailUrl?: string | null;
};

export const normalizeMangaTitle = (value: string): string => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('en-US')
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const stableId = (normalizedTitle: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalizedTitle.length; index += 1) {
    hash ^= normalizedTitle.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `manga_${(hash >>> 0).toString(36)}`;
};

const uniqueText = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return [];
    const key = normalizeMangaTitle(trimmed);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [trimmed];
  });
};

const pickFirst = <T>(values: Array<T | null | undefined>): T | null => (
  values.find((value): value is T => value !== null && value !== undefined) ?? null
);

/**
 * Groups only exact normalized titles or declared aliases. Fuzzy candidates remain
 * separate until they are explicitly verified, preventing destructive false merges.
 */
export function canonicalizeMangaCandidates(candidates: CanonicalMangaCandidate[]): CanonicalManga[] {
  const validCandidates = candidates.filter((candidate) => normalizeMangaTitle(candidate.title));
  const parents = validCandidates.map((_, index) => index);
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[Math.max(leftRoot, rightRoot)] = Math.min(leftRoot, rightRoot);
  };
  const candidateByIdentity = new Map<string, number>();

  validCandidates.forEach((candidate, candidateIndex) => {
    const identities = uniqueText([candidate.title, ...(candidate.alternativeTitles || [])])
      .map(normalizeMangaTitle)
      .filter(Boolean);

    identities.forEach((identity) => {
      const existingCandidate = candidateByIdentity.get(identity);
      if (existingCandidate !== undefined) union(candidateIndex, existingCandidate);
      else candidateByIdentity.set(identity, candidateIndex);
    });
  });

  const groupedCandidates = new Map<number, CanonicalMangaCandidate[]>();
  validCandidates.forEach((candidate, index) => {
    const root = find(index);
    groupedCandidates.set(root, [...(groupedCandidates.get(root) || []), candidate]);
  });

  return [...groupedCandidates.values()].map((group) => {
    const title = group[0].title.trim();
    const normalizedTitle = normalizeMangaTitle(title);
    const alternativeTitles = uniqueText(group.flatMap((candidate) => [
      candidate.title,
      ...(candidate.alternativeTitles || []),
    ])).filter((alternative) => normalizeMangaTitle(alternative) !== normalizedTitle);
    const sources = [...group.reduce((byProvider, candidate) => {
      if (!byProvider.has(candidate.provider)) {
        byProvider.set(candidate.provider, {
          provider: candidate.provider,
          externalId: candidate.externalId,
          title: candidate.title,
          language: candidate.language?.trim() || 'und',
          available: candidate.available !== false,
          readable: candidate.readable !== false,
          url: candidate.url || null,
          detailUrl: candidate.detailUrl || null,
        });
      }
      return byProvider;
    }, new Map<string, CanonicalSourceMapping>()).values()];

    return {
      canonicalId: stableId(normalizedTitle),
      normalizedTitle,
      title,
      alternativeTitles,
      author: pickFirst(group.map((candidate) => candidate.author)),
      type: pickFirst(group.map((candidate) => candidate.type)),
      status: pickFirst(group.map((candidate) => candidate.status)),
      cover: pickFirst(group.map((candidate) => candidate.cover)),
      genres: uniqueText(group.flatMap((candidate) => candidate.genres || [])),
      rating: pickFirst(group.map((candidate) => candidate.rating)),
      sources,
    };
  });
}

const languageCompatibility = (language: string, preferredLanguage: string): number => {
  const actual = language.trim().toLowerCase().split(/[-_]/)[0];
  const preferred = preferredLanguage.trim().toLowerCase().split(/[-_]/)[0];
  if (actual && actual === preferred) return 0;
  if (actual === 'multi') return 1;
  if (!actual || actual === 'und') return 2;
  return 3;
};

export const getPrimarySource = (
  manga: CanonicalManga,
  preferredLanguage = 'fr',
): CanonicalSourceMapping | null => {
  const readable = manga.sources
    .filter((source) => source.available && source.readable && source.detailUrl)
    .map((source, index) => ({ source, index }))
    .sort((left, right) => (
      languageCompatibility(left.source.language, preferredLanguage)
      - languageCompatibility(right.source.language, preferredLanguage)
      || left.index - right.index
    ));

  return readable[0]?.source
    ?? manga.sources.find((source) => source.available)
    ?? manga.sources[0]
    ?? null;
};

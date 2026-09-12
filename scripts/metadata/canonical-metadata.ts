import {
  canonicalTypeFromCountry,
  normalizeAliases,
  normalizeCountryOfOrigin,
  normalizeMetadataText,
  type CanonicalMangaType,
} from '../../supabase/functions/_shared/canonical-metadata.ts';

export type MatchConfidence = 'EXACT' | 'HIGH' | 'REVIEW' | 'REJECT';

export type CanonicalWork = {
  id: number;
  title: string;
  aliases: string[];
  author: string | null;
  manga_type: string | null;
  mangadex_id: string | null;
  sourceTitles: string[];
  metadata_confidence?: MatchConfidence | null;
};

export type AniListMedia = {
  source?: 'anilist' | 'jikan' | 'kitsu' | 'mangaupdates' | 'mangadex';
  searchIncomplete?: boolean;
  normalizedType?: CanonicalMangaType;
  status?: string | null;
  id: number | string;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[];
  countryOfOrigin: string | null;
  format: string | null;
  startDate: { year: number | null };
  staff: { edges: Array<{ role: string | null; node: { name: { full: string | null } } }> };
  externalLinks: Array<{ site: string | null; url: string | null }>;
};

export type MatchDecision = {
  confidence: MatchConfidence;
  media: AniListMedia | null;
  reasons: string[];
  aliases: string[];
  countryOfOrigin: string | null;
  mangaType: CanonicalMangaType;
  collisions: Array<{ alias: string; canonicalId: number }>;
};

const confidenceRank: Record<MatchConfidence, number> = { REJECT: 0, REVIEW: 1, HIGH: 2, EXACT: 3 };

function mediaTitles(media: AniListMedia): string[] {
  return [media.title.romaji, media.title.english, media.title.native, ...(media.synonyms || [])]
    .filter((value): value is string => Boolean(value?.trim()));
}

function mangaDexIds(media: AniListMedia): string[] {
  return (media.externalLinks || [])
    .filter((link) => normalizeMetadataText(link.site || '') === 'mangadex')
    .map((link) => link.url?.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0] || '')
    .filter(Boolean);
}

function authorNames(media: AniListMedia): string[] {
  return (media.staff?.edges || [])
    .filter((edge) => /story|original creator|art/i.test(edge.role || ''))
    .map((edge) => edge.node.name.full || '')
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function evaluateCandidate(work: CanonicalWork, media: AniListMedia): { confidence: MatchConfidence; reasons: string[] } {
  const canonical = normalizeMetadataText(work.title);
  const candidates = mediaTitles(media).map(normalizeMetadataText);
  const sources = work.sourceTitles.map(normalizeMetadataText);
  const reasons: string[] = [];

  // A novel/doujinshi with the same title is not proof of the comic's identity.
  if (media.source && media.source !== 'anilist' ? !media.normalizedType : media.format !== 'MANGA') {
    return { confidence: 'REJECT', reasons: ['unsupported publication format; adaptation identity unproven'] };
  }

  if (work.mangadex_id && (mangaDexIds(media).includes(work.mangadex_id) || (media.source === 'mangadex' && String(media.id) === work.mangadex_id))) {
    return { confidence: 'EXACT', reasons: ['stable MangaDex identifier overlap'] };
  }
  const sourceOverlap = sources.some((title) => candidates.includes(title));
  const canonicalAuthor = normalizeMetadataText(work.author || '');
  const authors = authorNames(media);
  const authorKey = (name: string) => normalizeMetadataText(name).split(' ').sort().join(' ');
  const authorOverlap = Boolean(canonicalAuthor) && authors.some((name) => authorKey(name) === authorKey(canonicalAuthor));
  const knownAuthor = canonicalAuthor && !['auteur inconnu', 'unknown', 'inconnu'].includes(canonicalAuthor);
  if (candidates.includes(canonical) || work.aliases.some((alias) => candidates.includes(normalizeMetadataText(alias)))) {
    if (knownAuthor && authors.length && !authorOverlap) {
      return { confidence: 'REVIEW', reasons: ['exact title or alias but author differs; identity needs review'] };
    }
    return { confidence: 'EXACT', reasons: ['exact normalized canonical title or existing alias'] };
  }
  const bestSimilarity = Math.max(0, ...candidates.map((title) => similarity(canonical, title)));

  if (sourceOverlap && authorOverlap) {
    reasons.push('exact trusted source-title overlap', 'author overlap');
    return { confidence: 'HIGH', reasons };
  }
  if (bestSimilarity >= 0.92 && authorOverlap) {
    reasons.push(`title similarity ${bestSimilarity.toFixed(3)}`, 'author overlap');
    return { confidence: 'HIGH', reasons };
  }
  if (sourceOverlap) reasons.push('source-title overlap without corroborating author');
  if (bestSimilarity >= 0.8) reasons.push(`uncorroborated title similarity ${bestSimilarity.toFixed(3)}`);
  return reasons.length ? { confidence: 'REVIEW', reasons } : { confidence: 'REJECT', reasons: ['insufficient identity evidence'] };
}

export function selectAniListMatch(
  work: CanonicalWork,
  candidates: AniListMedia[],
  canonicalTitleOwners: Map<string, number | number[]>,
): MatchDecision {
  const evaluated = candidates
    .map((media) => ({ media, ...evaluateCandidate(work, media) }))
    .sort((a, b) => {
      const diff = confidenceRank[b.confidence] - confidenceRank[a.confidence];
      if (diff !== 0) return diff;
      if (typeof a.media.id === 'number' && typeof b.media.id === 'number') {
        return a.media.id - b.media.id;
      }
      return String(a.media.id).localeCompare(String(b.media.id));
    });
  const best = evaluated[0];
  if (!best || best.confidence === 'REJECT') {
    return { confidence: 'REJECT', media: best?.media || null, reasons: best?.reasons || ['no candidate'], aliases: [], countryOfOrigin: null, mangaType: null, collisions: [] };
  }
  const tied = evaluated.filter((item) => confidenceRank[item.confidence] === confidenceRank[best.confidence]);
  if (tied.length > 1 && confidenceRank[best.confidence] >= confidenceRank.HIGH) {
    return { confidence: 'REVIEW', media: best.media, reasons: ['multiple equally confident metadata candidates'], aliases: [], countryOfOrigin: null, mangaType: null, collisions: [] };
  }
  if (best.media.searchIncomplete) {
    return { confidence: 'REVIEW', media: best.media, reasons: [...best.reasons, 'truncated provider search; uniqueness unproven'], aliases: [], countryOfOrigin: null, mangaType: null, collisions: [] };
  }

  const aliases = normalizeAliases(work.title, mediaTitles(best.media));
  const collisions = [work.title, ...aliases].flatMap((alias) => {
    const owner = canonicalTitleOwners.get(normalizeMetadataText(alias));
    return (Array.isArray(owner) ? owner : owner === undefined ? [] : [owner])
      .filter((id) => id !== work.id).map((canonicalId) => ({ alias, canonicalId }));
  });
  if (collisions.length) {
    return { confidence: 'REVIEW', media: best.media, reasons: [...best.reasons, 'alias collides with another canonical title'], aliases: [], countryOfOrigin: null, mangaType: null, collisions };
  }
  const countryOfOrigin = normalizeCountryOfOrigin(best.media.countryOfOrigin);
  const mangaType = best.media.source && best.media.source !== 'anilist' ? best.media.normalizedType ?? null : canonicalTypeFromCountry(countryOfOrigin);
  if (['manga', 'manhwa', 'manhua'].includes(work.manga_type || '') && mangaType && work.manga_type !== mangaType
    && (!work.metadata_confidence || confidenceRank[best.confidence] <= confidenceRank[work.metadata_confidence])) {
    return { confidence: 'REVIEW', media: best.media, reasons: [...best.reasons, 'canonical type conflict without stronger identity evidence'], aliases: [], countryOfOrigin: null, mangaType: null, collisions };
  }
  return {
    confidence: best.confidence,
    media: best.media,
    reasons: best.reasons,
    aliases,
    countryOfOrigin,
    mangaType,
    collisions,
  };
}

export function mergeAliases(canonicalTitle: string, current: string[], incoming: string[]): string[] {
  return normalizeAliases(canonicalTitle, [...current, ...incoming]);
}

export function shouldOverwriteMetadata(existing: MatchConfidence | null, incoming: MatchConfidence): boolean {
  if (incoming !== 'EXACT' && incoming !== 'HIGH') return false;
  return !existing || confidenceRank[incoming] > confidenceRank[existing];
}

// Both provider adapters feed this single matching implementation.
export const selectMetadataMatch = selectAniListMatch;

export function quarantineBatchCollisions(items: Array<{ work: CanonicalWork; decision: MatchDecision }>): void {
  const identities = new Map<string, typeof items>();
  for (const item of items) {
    if (!item.decision.media || item.decision.confidence === 'REJECT') continue;
    if (item.decision.confidence === 'REVIEW' && !item.decision.reasons.some((reason) =>
      reason === 'exact normalized canonical title or existing alias' || reason === 'stable MangaDex identifier overlap' || reason === 'author overlap')) continue;
    const media = item.decision.media;
    const keys = [`id:${media.source || 'anilist'}:${media.id}`, ...normalizeAliases('', [item.work.title, ...item.decision.aliases]).map((alias) => `alias:${normalizeMetadataText(alias)}`)];
    for (const key of keys) identities.set(key, [...(identities.get(key) || []), item]);
  }
  for (const [key, group] of identities) {
    if (new Set(group.map((item) => item.work.id)).size < 2) continue;
    for (const item of group) {
      item.decision.confidence = 'REVIEW';
      item.decision.reasons.push(`shared proposed identity: ${key}`);
      for (const other of group) if (other.work.id !== item.work.id) {
        item.decision.collisions.push({ alias: key, canonicalId: other.work.id });
      }
      item.decision.aliases = [];
      item.decision.mangaType = null;
      item.decision.countryOfOrigin = null;
    }
  }
}

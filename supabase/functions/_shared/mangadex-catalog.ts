import { canonicalTypeFromCountry, countryFromMangaDexLanguage } from './canonical-metadata.ts';

type LocalizedText = Record<string, string>;

export type MangaDexRelationship = {
  id: string;
  type: string;
  attributes?: { name?: string; fileName?: string };
};

type MangaDexTag = { attributes?: { group?: string; name?: LocalizedText } };

export type MangaDexManga = {
  id: string;
  attributes: {
    title: LocalizedText;
    description: LocalizedText;
    originalLanguage?: string;
    status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
    contentRating?: string;
    updatedAt?: string;
    tags?: MangaDexTag[];
  };
  relationships?: MangaDexRelationship[];
};

export type CatalogRow = {
  mangadex_id: string;
  title: string;
  author: string;
  artist: string | null;
  description: string | null;
  cover_image: string | null;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  genre: string[];
  manga_type: string | null;
  content_rating: string | null;
  source_updated_at: string | null;
  last_synced_at: string;
};

export type CatalogSyncPlan = { languages: string[]; pages: number; pageSize: number };

/** MangaDex caps a page at 100 and offset + limit at 10 000. */
export const MANGADEX_PAGE_SIZE = 100;
export const MAX_SYNC_PAGES = 10;
/** Languages the reader can open; French first, so French titles win on conflicts. */
export const SYNC_LANGUAGES = ['fr', 'en'] as const;
export const DEFAULT_SYNC_PLAN: CatalogSyncPlan = { languages: ['fr', 'en'], pages: 3, pageSize: MANGADEX_PAGE_SIZE };

/**
 * Validates an optional JSON body ({ pages, languages }) against safe bounds.
 * Unknown languages are dropped; nonsense falls back to the default plan.
 */
export function parseSyncPlan(body: unknown): CatalogSyncPlan {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const pages = Number.isInteger(input.pages)
    ? Math.min(MAX_SYNC_PAGES, Math.max(1, input.pages as number))
    : DEFAULT_SYNC_PLAN.pages;
  const languages = Array.isArray(input.languages)
    ? [...new Set(input.languages.filter((value): value is string => (SYNC_LANGUAGES as readonly string[]).includes(value as string)))]
    : DEFAULT_SYNC_PLAN.languages;
  return { languages: languages.length ? languages : DEFAULT_SYNC_PLAN.languages, pages, pageSize: MANGADEX_PAGE_SIZE };
}

/** Most-followed titles available in one language, safe or suggestive only. */
export function buildMangaDexQuery(language: string, page: number, pageSize = MANGADEX_PAGE_SIZE): URLSearchParams {
  const query = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
    'order[followedCount]': 'desc',
  });
  query.append('availableTranslatedLanguage[]', language);
  for (const value of ['cover_art', 'author', 'artist']) query.append('includes[]', value);
  for (const value of ['safe', 'suggestive']) query.append('contentRating[]', value);
  return query;
}

export function localizedText(value?: LocalizedText): string {
  if (!value) return '';
  for (const locale of ['fr', 'en', 'ja-ro', 'ja']) {
    const candidate = value[locale];
    if (candidate?.trim()) return candidate.trim();
  }
  return Object.values(value).find((candidate) => candidate?.trim())?.trim() || '';
}

const relationshipName = (relationships: MangaDexRelationship[], type: string): string | null => (
  relationships.find((relationship) => relationship.type === type)?.attributes?.name?.trim() || null
);

export function mangaDexCoverUrl(proxyUrl: string, mangaId: string, relationships: MangaDexRelationship[]): string | null {
  const fileName = relationships.find((relationship) => relationship.type === 'cover_art')?.attributes?.fileName;
  return fileName ? `${proxyUrl}/cover/${encodeURIComponent(mangaId)}/${encodeURIComponent(fileName)}.256.jpg` : null;
}

export function toCatalogRow(manga: MangaDexManga, syncedAt: string, proxyUrl: string): CatalogRow | null {
  const relationships = manga.relationships || [];
  const title = localizedText(manga.attributes?.title);
  if (!manga.id || !title) return null;
  // Defensive: the query already filters ratings, but never trust a page blindly.
  if (manga.attributes.contentRating && !['safe', 'suggestive'].includes(manga.attributes.contentRating)) return null;
  const country = countryFromMangaDexLanguage(manga.attributes.originalLanguage);
  return {
    mangadex_id: manga.id,
    title,
    author: relationshipName(relationships, 'author') || 'Auteur inconnu',
    artist: relationshipName(relationships, 'artist'),
    description: localizedText(manga.attributes.description) || null,
    cover_image: mangaDexCoverUrl(proxyUrl, manga.id, relationships),
    status: manga.attributes.status || 'ongoing',
    genre: (manga.attributes.tags || [])
      .filter((tag) => tag.attributes?.group === 'genre')
      .map((tag) => localizedText(tag.attributes?.name))
      .filter(Boolean),
    manga_type: canonicalTypeFromCountry(country),
    content_rating: manga.attributes.contentRating || null,
    source_updated_at: manga.attributes.updatedAt || null,
    last_synced_at: syncedAt,
  };
}

/** Keeps the first row per MangaDex id (passes run French first). */
export function mergeCatalogRows(rows: CatalogRow[]): CatalogRow[] {
  const byId = new Map<string, CatalogRow>();
  for (const row of rows) if (!byId.has(row.mangadex_id)) byId.set(row.mangadex_id, row);
  return [...byId.values()];
}

/**
 * Known identities only receive refreshable fields: manga_type, aliases and
 * enrichment provenance belong to the reviewed metadata pipeline.
 */
export function splitCatalogWrites(rows: CatalogRow[], knownIds: Set<string>) {
  const refresh = rows.filter((row) => knownIds.has(row.mangadex_id)).map(({ manga_type: _type, ...fields }) => fields);
  const insert = rows.filter((row) => !knownIds.has(row.mangadex_id));
  return { refresh, insert };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export type CanonicalMatch = {
  manga_id: number;
  confidence: number;
  mangadex_id: string | null;
  author: string | null;
};

const UNKNOWN_AUTHORS = new Set(['', 'auteur inconnu', 'unknown', 'auteur non renseigne']);
const authorKey = (value: string | null | undefined) => (value || '')
  .normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Decides whether a new MangaDex title is a work already imported from a scan
 * source (no mangadex_id yet). Exact title/alias matches only — never fuzzy —,
 * compatible authors, and a single candidate; otherwise a new row is created.
 */
export function chooseIdentityToAttach(candidate: Pick<CatalogRow, 'author'>, matches: CanonicalMatch[]): number | null {
  const candidateAuthor = authorKey(candidate.author);
  const eligible = matches.filter((match) => {
    if (match.confidence < 0.95 || match.mangadex_id) return false;
    const existingAuthor = authorKey(match.author);
    return UNKNOWN_AUTHORS.has(existingAuthor) || UNKNOWN_AUTHORS.has(candidateAuthor) || existingAuthor === candidateAuthor;
  });
  return eligible.length === 1 ? eligible[0].manga_id : null;
}

export const SITE_NAME = 'Manga Wave';
export const DEFAULT_DOCUMENT_TITLE = 'Manga Wave — Découvrez et lisez vos mangas';
export const DEFAULT_DOCUMENT_DESCRIPTION = 'Découvrez, suivez et lisez vos mangas depuis une bibliothèque canonique multi-source.';
export const MAX_DESCRIPTION_LENGTH = 160;
export const DEFAULT_SOCIAL_IMAGE_PATH = '/icons/manga-wave-512.png';

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * Builds a tab title such as "One Piece — Chapitre 12 · Manga Wave".
 * Empty parts are skipped; no parts yields the homepage default title.
 */
export function formatDocumentTitle(...parts: Array<string | null | undefined>): string {
  const cleaned = parts.map((part) => collapseWhitespace(part || '')).filter(Boolean);
  if (cleaned.length === 0) return DEFAULT_DOCUMENT_TITLE;
  return `${cleaned.join(' — ')} · ${SITE_NAME}`;
}

/** Normalizes a synopsis into a meta description, cut on a word boundary. */
export function formatDocumentDescription(value: string | null | undefined): string {
  const text = collapseWhitespace(value || '');
  if (!text) return DEFAULT_DOCUMENT_DESCRIPTION;
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  const slice = text.slice(0, MAX_DESCRIPTION_LENGTH - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > MAX_DESCRIPTION_LENGTH / 2 ? slice.slice(0, lastSpace) : slice).replace(/[\s,;:.—-]+$/, '')}…`;
}

export function formatChapterLabel(chapterNumber: string | null | undefined): string | null {
  const number = collapseWhitespace(chapterNumber || '');
  return number ? `Chapitre ${number}` : null;
}

/** Resolves only public HTTP(S) URLs so metadata never accepts executable schemes. */
export function toPublicHttpUrl(value: string | null | undefined, baseUrl: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Provider query parameters are intentionally excluded from shared canonical URLs. */
export function buildCanonicalMangaUrl(origin: string, canonicalId: string | number): string | null {
  const id = String(canonicalId).trim();
  return id ? toPublicHttpUrl(`/manga/${encodeURIComponent(id)}`, origin) : null;
}

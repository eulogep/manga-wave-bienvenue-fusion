export const SITE_NAME = 'Manga Wave';
export const DEFAULT_DOCUMENT_TITLE = 'Manga Wave — Découvrez et lisez vos mangas';
export const DEFAULT_DOCUMENT_DESCRIPTION = 'Découvrez, suivez et lisez vos mangas depuis une bibliothèque canonique multi-source.';
export const MAX_DESCRIPTION_LENGTH = 160;

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

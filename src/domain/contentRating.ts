/**
 * Genre-based content-rating classification for sources whose own extractor
 * payload has no explicit `contentRating` field (unlike MangaDex, which
 * supplies one directly). Used for Sushi-Scan per explicit product decision:
 * integrate the source as-is (its own genre taxonomy already includes
 * explicit-content tags mixed into the general catalogue), but mark
 * `contentRating` from those tags rather than leaving works unmarked —
 * matching how MangaDex's own `erotica` rating already flows through this
 * app today. This never filters or hides anything; it only labels.
 *
 * Matching is exact-tag, never substring — a genre must equal one of these
 * markers after normalization, so an unrelated tag that merely contains a
 * similar-looking fragment is never misclassified.
 */

const EXPLICIT_GENRE_MARKERS = new Set([
  'erotique', 'erotic', 'erotica', 'hentai', 'adulte', 'adult', 'pornhwa', '18+',
]);

const normalize = (value: string): string => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/** Returns 'erotica' when a genre exactly matches a known explicit-content marker, else null (never a guess). */
export function classifyContentRatingFromGenres(genres: string[]): string | null {
  const isExplicit = genres.some((genre) => EXPLICIT_GENRE_MARKERS.has(normalize(genre)));
  return isExplicit ? 'erotica' : null;
}

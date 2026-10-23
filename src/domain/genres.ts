import { normalizeQuery } from './canonicalSearch.ts';

/**
 * Canonical genre keys stay in English because existing links use them
 * (e.g. /search?genre=Comedy); labels are what visitors read.
 */
export const GENRE_LABELS: Record<string, string> = {
  Action: 'Action',
  Adventure: 'Aventure',
  Comedy: 'Comédie',
  Drama: 'Drame',
  Fantasy: 'Fantasy',
  Horror: 'Horreur',
  Isekai: 'Isekai',
  Mystery: 'Mystère',
  Psychological: 'Psychologique',
  Romance: 'Romance',
  'Sci-Fi': 'Science-fiction',
  'Slice of Life': 'Tranche de vie',
  Thriller: 'Thriller',
  Tragedy: 'Tragédie',
  Superhero: 'Super-héros',
  'School Life': 'Vie scolaire',
  "Girls' Love": "Girls' Love",
  "Boys' Love": "Boys' Love",
  Historical: 'Historique',
  Mecha: 'Mecha',
  Medical: 'Médical',
  Sports: 'Sport',
  Harem: 'Harem',
  Ecchi: 'Ecchi',
  Mature: 'Mature',
  Smut: 'Érotique',
};

// Source spellings (French, plural, synonyms) that mean an existing canonical genre.
const GENRE_ALIASES: Record<string, string> = {
  aventure: 'Adventure',
  comedie: 'Comedy',
  drame: 'Drama',
  fantastique: 'Fantasy',
  horreur: 'Horror',
  mystere: 'Mystery',
  psychologique: 'Psychological',
  'science fiction': 'Sci-Fi',
  'sci fi': 'Sci-Fi',
  scifi: 'Sci-Fi',
  'tranche de vie': 'Slice of Life',
  'tranches de vie': 'Slice of Life',
  tragedie: 'Tragedy',
  'super heros': 'Superhero',
  'vie scolaire': 'School Life',
  school: 'School Life',
  historique: 'Historical',
  medical: 'Medical',
  sport: 'Sports',
  erotique: 'Smut',
  pornhwa: 'Smut',
};

// Language and scanlation markers some sources store in the genre column.
const LANGUAGE_TAGS = new Set(['en', 'eng', 'english', 'anglais', 'fr', 'vf', 'vostfr', 'francais', 'french', 'scan fr', 'raw', 'raws']);

// Format markers: not genres, but they reveal the type when manga_type is missing.
const FORMAT_TAGS: Record<string, 'manga' | 'manhwa' | 'manhua' | null> = {
  manga: 'manga',
  manhwa: 'manhwa',
  'manhwa p': 'manhwa',
  manhua: 'manhua',
  webtoon: null,
  'one shot': null,
  oneshot: null,
};

const own = <V>(table: Record<string, V>, key: string): V | undefined => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined);

// Built lazily: canonicalSearch imports this module, so normalizeQuery is not
// initialized yet while this module first evaluates.
let canonicalByKey: Map<string, string> | null = null;
const lookupCanonical = (key: string) => {
  canonicalByKey ??= new Map(Object.keys(GENRE_LABELS).map((genre) => [normalizeQuery(genre), genre]));
  return canonicalByKey.get(key);
};

/** Canonical key for a raw genre, or null when the tag is a language/format marker. */
export function canonicalGenre(raw: string | null | undefined): string | null {
  const key = normalizeQuery(raw || '');
  if (!key || LANGUAGE_TAGS.has(key) || Object.prototype.hasOwnProperty.call(FORMAT_TAGS, key)) return null;
  return lookupCanonical(key) || own(GENRE_ALIASES, key) || (raw || '').trim();
}

/** Deduplicated canonical genres, in source order. */
export function normalizeGenres(raw: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const genres: string[] = [];
  for (const value of raw || []) {
    const genre = canonicalGenre(value);
    if (genre && !seen.has(genre)) {
      seen.add(genre);
      genres.push(genre);
    }
  }
  return genres;
}

/** Keeps a known manga_type; otherwise infers it from format tags in the genre column. */
export function inferMangaType(mangaType: string | null | undefined, rawGenres: string[] | null | undefined): string | null {
  if (mangaType?.trim()) return mangaType;
  for (const value of rawGenres || []) {
    const format = own(FORMAT_TAGS, normalizeQuery(value));
    if (format) return format;
  }
  return null;
}

export function genreLabel(genre: string): string {
  return own(GENRE_LABELS, canonicalGenre(genre) || genre) || genre;
}

/** Applies genre and type normalization to a catalogue row without touching other fields. */
export function normalizeWorkMetadata<T extends { genre: string[] | null; manga_type: string | null }>(work: T): T {
  return { ...work, genre: normalizeGenres(work.genre), manga_type: inferMangaType(work.manga_type, work.genre) };
}

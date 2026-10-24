import type { LibraryItem } from './libraryItem.ts';
import type { UserList, UserListItem } from './userLists.ts';
import { sortListItems, sortUserLists } from './userLists.ts';
import { discoveryStatusLabel } from './discoveryPresentation.ts';
import { genreLabel, normalizeGenres } from './genres.ts';

export const LIBRARY_EXPORT_VERSION = 1;

export type LibraryExportEntry = {
  canonicalMangaId: number | null;
  title: string;
  author: string | null;
  status: string | null;
  genres: string[];
  favorite: boolean;
  favoritedAt: string | null;
  following: boolean;
  followedAt: string | null;
  currentChapter: string | null;
  progressPercent: number | null;
  lastReadAt: string | null;
  lists: string[];
};

export type LibraryExportList = {
  name: string;
  kind: UserList['kind'];
  items: { canonicalMangaId: number; title: string | null; note: string | null }[];
};

export type LibraryExport = {
  format: 'manga-wave-library';
  version: number;
  exportedAt: string;
  library: LibraryExportEntry[];
  lists: LibraryExportList[];
};

/**
 * Snapshot of a reader's own data for backup or migration. Provider identifiers are
 * left out on purpose: they are implementation details, the canonical id is the identity.
 */
export function buildLibraryExport(
  items: LibraryItem[],
  lists: UserList[],
  listItems: (UserListItem & { manga?: { title: string } | null })[],
  now = new Date(),
): LibraryExport {
  const orderedLists = sortUserLists(lists);
  const listNamesByManga = new Map<number, string[]>();
  for (const list of orderedLists) {
    for (const item of listItems.filter((entry) => entry.listId === list.id)) {
      listNamesByManga.set(item.canonicalMangaId, [...(listNamesByManga.get(item.canonicalMangaId) || []), list.name]);
    }
  }

  const titlesById = new Map(items.filter((item) => item.canonicalMangaId !== null).map((item) => [item.canonicalMangaId as number, item.title]));

  return {
    format: 'manga-wave-library',
    version: LIBRARY_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    library: [...items]
      .sort((left, right) => left.title.localeCompare(right.title, 'fr'))
      .map((item) => ({
        canonicalMangaId: item.canonicalMangaId,
        title: item.title,
        author: item.author,
        status: item.canonicalStatus,
        genres: normalizeGenres(item.genre),
        favorite: item.favorite,
        favoritedAt: item.favoritedAt,
        following: item.following,
        followedAt: item.followedAt,
        currentChapter: item.currentChapterNumber,
        progressPercent: item.progressPercent,
        lastReadAt: item.lastReadAt,
        lists: item.canonicalMangaId !== null ? listNamesByManga.get(item.canonicalMangaId) || [] : [],
      })),
    lists: orderedLists.map((list) => ({
      name: list.name,
      kind: list.kind,
      items: sortListItems(listItems.filter((entry) => entry.listId === list.id)).map((entry) => ({
        canonicalMangaId: entry.canonicalMangaId,
        title: entry.manga?.title || titlesById.get(entry.canonicalMangaId) || null,
        note: entry.note,
      })),
    })),
  };
}

/**
 * Quotes a CSV cell and neutralizes spreadsheet formulas: titles come from external
 * sources, and a cell starting with = + - @ (or tab/CR) would run as a formula.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'boolean' ? (value ? 'oui' : 'non') : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

const CSV_HEADERS = [
  'Titre', 'Auteur', 'Statut', 'Genres', 'Favori', 'Suivi', 'Chapitre en cours',
  'Progression (%)', 'Dernière lecture', 'Listes', 'Identifiant Manga Wave',
];

/** One row per library title; semicolon-separated with a BOM so Excel opens accents correctly. */
export function libraryExportToCsv(data: LibraryExport): string {
  const rows = data.library.map((entry) => [
    entry.title, entry.author, entry.status && discoveryStatusLabel(entry.status), entry.genres.map(genreLabel).join(', '), entry.favorite, entry.following,
    entry.currentChapter, entry.progressPercent, entry.lastReadAt, entry.lists.join(', '), entry.canonicalMangaId,
  ].map(csvCell).join(';'));
  return `\uFEFF${[CSV_HEADERS.join(';'), ...rows].join('\r\n')}\r\n`;
}

export function libraryExportFileName(extension: 'json' | 'csv', now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `manga-wave-bibliotheque-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${extension}`;
}

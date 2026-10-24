import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLibraryExport,
  csvCell,
  libraryExportFileName,
  libraryExportToCsv,
} from '../src/domain/libraryExport.ts';
import type { LibraryItem } from '../src/domain/libraryItem.ts';
import type { UserList, UserListItem } from '../src/domain/userLists.ts';

const item = (patch: Partial<LibraryItem>): LibraryItem => ({
  canonicalKey: `manga:${patch.canonicalMangaId}`, canonicalMangaId: 1, title: 'Titre', author: null, cover: null, genre: [],
  canonicalStatus: 'ongoing', favorite: false, favoritedAt: null, following: false, followedAt: null, hasProgress: false,
  currentChapterNumber: null, progressPercent: null, lastReadAt: null,
  resume: { source: 'secret-provider', providerMangaId: 'p-1', chapterId: 'c-1', language: 'fr', pageIndex: 3, chapterNumber: '4' },
  unreadUpdate: null, updatedAt: '2026-10-01T00:00:00.000Z', ...patch,
});
const list = (id: number, name: string, kind: UserList['kind'] = 'custom', position = 3): UserList => ({ id, name, kind, position, createdAt: '' });
const entry = (id: number, listId: number, canonicalMangaId: number, position: number, note: string | null = null): UserListItem => ({
  id, listId, canonicalMangaId, position, note, createdAt: '',
});

const now = new Date(2026, 9, 24, 10);
const items = [
  item({ canonicalMangaId: 2, title: 'Berserk', author: 'Miura', favorite: true, genre: ['Action', 'EN', 'Drame'], currentChapterNumber: '120', progressPercent: 40 }),
  item({ canonicalMangaId: 1, title: 'Akira', following: true }),
];
const lists = [list(9, 'Fantasy sombre'), list(1, 'À lire', 'to_read', 0)];
const listItems = [entry(1, 1, 2, 1), entry(2, 1, 1, 0, 'offert par Léa'), entry(3, 9, 2, 0)];

test('export is sorted by title, carries list membership in list order, and omits provider ids', () => {
  const data = buildLibraryExport(items, lists, listItems, now);
  assert.equal(data.format, 'manga-wave-library');
  assert.equal(data.exportedAt, now.toISOString());
  assert.deepEqual(data.library.map((row) => row.title), ['Akira', 'Berserk']);
  assert.deepEqual(data.library[1].lists, ['À lire', 'Fantasy sombre']);
  assert.doesNotMatch(JSON.stringify(data), /secret-provider|p-1|c-1/);
});

test('lists keep their system-first order, manual item order and private notes', () => {
  const data = buildLibraryExport(items, lists, listItems, now);
  assert.deepEqual(data.lists.map((entry) => entry.name), ['À lire', 'Fantasy sombre']);
  assert.deepEqual(data.lists[0].items, [
    { canonicalMangaId: 1, title: 'Akira', note: 'offert par Léa' },
    { canonicalMangaId: 2, title: 'Berserk', note: null },
  ]);
});

test('CSV cells neutralize spreadsheet formulas from external titles', () => {
  for (const dangerous of ['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)', '\tcmd']) {
    assert.ok(csvCell(dangerous).replace(/^"/, '').startsWith("'"), dangerous);
  }
  assert.equal(csvCell('Berserk'), 'Berserk');
});

test('CSV cells quote separators, quotes and line breaks', () => {
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('dit "bonjour"'), '"dit ""bonjour"""');
  assert.equal(csvCell('ligne\nsuivante'), '"ligne\nsuivante"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(true), 'oui');
});

test('CSV has a BOM, a French header and one row per title', () => {
  const csv = libraryExportToCsv(buildLibraryExport(items, lists, listItems, now));
  assert.ok(csv.startsWith('\uFEFFTitre;Auteur;'));
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.match(lines[2], /^Berserk;Miura;En cours;Action, Drame;oui;non;120;40;;À lire, Fantasy sombre;2$/);
});

test('file names are dated', () => {
  assert.equal(libraryExportFileName('csv', now), 'manga-wave-bibliotheque-2026-10-24.csv');
});

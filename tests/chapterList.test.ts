import assert from 'node:assert/strict';
import test from 'node:test';
import { filterChapters, firstReadableChapter, sortChapters } from '../src/domain/chapterList.ts';

const chapters = [
  { id: '10', chapterNumber: '10', title: 'Final', date: '2026-02-01T00:00:00Z', scanlationGroup: 'Wave' },
  { id: '2', chapterNumber: '2.5', title: 'Interlude', date: '2026-01-02T00:00:00Z', scanlationGroup: 'Moon' },
  { id: '1', chapterNumber: '001.00', title: 'Départ', date: '2026-01-01T00:00:00Z', scanlationGroup: 'Wave' },
  { id: 'special', chapterNumber: 'extra', title: 'Bonus', date: '2026-03-01T00:00:00Z' },
];

test('chapter sorting uses logical numeric identity and keeps specials after numbered chapters', () => {
  assert.deepEqual(sortChapters(chapters, 'asc').map((chapter) => chapter.id), ['1', '2', '10', 'special']);
  assert.deepEqual(sortChapters(chapters, 'desc').map((chapter) => chapter.id), ['10', '2', '1', 'special']);
});

test('start reading resolves the earliest logical chapter independently from provider order', () => {
  assert.equal(firstReadableChapter(chapters)?.id, '1');
});

test('chapter search covers number, title and scanlation group with normalized accents', () => {
  assert.deepEqual(filterChapters(chapters, '2.5').map((chapter) => chapter.id), ['2']);
  assert.deepEqual(filterChapters(chapters, 'depart').map((chapter) => chapter.id), ['1']);
  assert.deepEqual(filterChapters(chapters, 'wave').map((chapter) => chapter.id), ['10', '1']);
});

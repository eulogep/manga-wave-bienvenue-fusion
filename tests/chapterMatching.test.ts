import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findEquivalentChapter,
  getHighestLogicalChapterNumber,
  normalizeLogicalChapterNumber,
} from '../src/domain/chapterMatching.ts';

const chapter = (id: string, chapterNumber: string) => ({ id, chapterNumber });

test('matches the exact logical chapter number', () => {
  assert.equal(findEquivalentChapter('5', [chapter('c1', '1'), chapter('c5', '5')])?.chapter.id, 'c5');
});

test('matches compatible decimal notation without changing chapter identity', () => {
  assert.equal(normalizeLogicalChapterNumber('012.500'), '12.5');
  assert.equal(findEquivalentChapter('12.5', [chapter('decimal', '12.50')])?.chapter.id, 'decimal');
});

test('never substitutes chapter 1 when there is no match', () => {
  assert.equal(findEquivalentChapter('200', [chapter('first', '1'), chapter('other', '199')]), null);
});

test('rejects mismatched provider numbering and an empty chapter list', () => {
  assert.equal(findEquivalentChapter('5', [chapter('season-number', '1005')]), null);
  assert.equal(findEquivalentChapter('5', []), null);
  assert.equal(findEquivalentChapter(undefined, [chapter('first', '1')]), null);
});

test('derives latest chapter from the highest valid parsed number', () => {
  assert.equal(getHighestLogicalChapterNumber([chapter('bad', '0'), chapter('c199', '199'), chapter('c200', '200')]), '200');
});

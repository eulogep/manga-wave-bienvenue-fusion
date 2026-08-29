import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendTriedSource,
  parseTriedSources,
  selectAutomaticFallback,
} from '../src/domain/automaticFallback.ts';

const candidates = [
  { source: 'slow', chapter: { id: 'slow-chapter' }, sourceScore: 42 },
  { source: 'best', chapter: { id: 'best-chapter' }, sourceScore: 91 },
  { source: 'missing', chapter: null, sourceScore: 99 },
];

test('selects the highest-ranked source that has the requested chapter', () => {
  assert.equal(selectAutomaticFallback(candidates, 'primary', [])?.source, 'best');
});

test('never retries current or previously attempted sources', () => {
  assert.equal(selectAutomaticFallback(candidates, 'primary', ['best'])?.source, 'slow');
  assert.equal(selectAutomaticFallback(candidates, 'best', ['primary', 'slow']), null);
});

test('stops after the automatic attempt budget', () => {
  assert.equal(selectAutomaticFallback(candidates, 'primary', ['one', 'two'], 3), null);
});

test('parses and appends tried sources without duplicates', () => {
  assert.deepEqual(parseTriedSources('mangadex, comick,mangadex'), ['mangadex', 'comick']);
  assert.deepEqual(appendTriedSource(['mangadex'], 'mangadex'), ['mangadex']);
});

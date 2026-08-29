import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendTriedSource,
  buildFallbackNotice,
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

test('prefers a same-language fallback before a higher-scored cross-language source', () => {
  const multilingual = [
    { source: 'english', language: 'en', chapter: { id: 'en-5' }, sourceScore: 99 },
    { source: 'french', language: 'fr-FR', chapter: { id: 'fr-5' }, sourceScore: 70 },
  ];
  assert.equal(selectAutomaticFallback(multilingual, 'primary', [], 3, 'fr')?.source, 'french');
});

test('allows an explicit cross-language fallback only when no same-language chapter exists', () => {
  const englishOnly = [
    { source: 'english', language: 'en', chapter: { id: 'en-5' }, sourceScore: 80 },
    { source: 'french-missing', language: 'fr', chapter: null, sourceScore: 100 },
  ];
  assert.equal(selectAutomaticFallback(englishOnly, 'primary', [], 3, 'fr')?.source, 'english');
});

test('cross-language fallback notice reports the actual language transition', () => {
  assert.equal(
    buildFallbackNotice({ previousSource: 'OriginManga', nextSource: 'AsuraScans', previousLanguage: 'fr', nextLanguage: 'en' }),
    'OriginManga est indisponible. Passage temporaire de FR à EN via AsuraScans.',
  );
});

test('parses and appends tried sources without duplicates', () => {
  assert.deepEqual(parseTriedSources('mangadex, comick,mangadex'), ['mangadex', 'comick']);
  assert.deepEqual(appendTriedSource(['mangadex'], 'mangadex'), ['mangadex']);
});

test('keeps the controlled no-source state when every exact chapter is missing', () => {
  const missing = [
    { source: 'one', chapter: null, sourceScore: 90 },
    { source: 'two', chapter: null, sourceScore: 80 },
  ];
  assert.equal(selectAutomaticFallback(missing, 'primary', []), null);
});

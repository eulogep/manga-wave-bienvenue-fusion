import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalizeMangaCandidates,
  getPrimarySource,
  normalizeMangaTitle,
} from '../src/domain/canonicalManga.ts';

test('normalizes case, accents and punctuation deterministically', () => {
  assert.equal(normalizeMangaTitle('  L’Épée-du Héros!! '), 'lepee du heros');
});

test('deduplicates exact canonical titles across providers', () => {
  const result = canonicalizeMangaCandidates([
    { provider: 'mangadex', externalId: 'dex-1', title: 'Solo Leveling', language: 'multi', detailUrl: '/manga/dex-1?source=mangadex' },
    { provider: 'originmanga', externalId: 'om-1', title: 'SOLO-LEVELING', language: 'fr', detailUrl: '/manga/om-1?source=originmanga' },
    { provider: 'comick', externalId: 'co-1', title: 'Solo Leveling', language: 'multi', detailUrl: '/manga/co-1?source=comick' },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Solo Leveling');
  assert.equal(result[0].sources.length, 3);
});

test('uses declared aliases without fuzzy-merging distinct titles', () => {
  const result = canonicalizeMangaCandidates([
    { provider: 'mangadex', externalId: '1', title: 'Boku no Hero Academia', alternativeTitles: ['My Hero Academia'] },
    { provider: 'comick', externalId: '2', title: 'My Hero Academia' },
    { provider: 'originmanga', externalId: '3', title: 'My Hero Academia: Vigilantes' },
  ]);

  assert.equal(result.length, 2);
  assert.equal(result[0].sources.length, 2);
  assert.equal(result[1].sources.length, 1);
});

test('merges groups bridged by a verified alias', () => {
  const result = canonicalizeMangaCandidates([
    { provider: 'one', externalId: '1', title: 'Shingeki no Kyojin' },
    { provider: 'two', externalId: '2', title: 'Attack on Titan' },
    { provider: 'verified', externalId: '3', title: 'Shingeki no Kyojin', alternativeTitles: ['Attack on Titan'] },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].sources.length, 3);
});

test('keeps a deterministic readable mapping without source scoring', () => {
  const [manga] = canonicalizeMangaCandidates([
    { provider: 'metadata', externalId: 'meta', title: 'One Piece', readable: false, detailUrl: null },
    { provider: 'mangadex', externalId: 'dex', title: 'One Piece', readable: true, detailUrl: '/manga/dex?source=mangadex' },
  ]);

  assert.equal(getPrimarySource(manga)?.provider, 'mangadex');
});

test('counts a provider only once inside a canonical work', () => {
  const [manga] = canonicalizeMangaCandidates([
    { provider: 'comick', externalId: 'first', title: 'Tower of God' },
    { provider: 'comick', externalId: 'duplicate', title: 'Tower-of-God' },
  ]);

  assert.equal(manga.sources.length, 1);
  assert.equal(manga.sources[0].externalId, 'first');
});

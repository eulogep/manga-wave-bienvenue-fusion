import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalizeMangaCandidates, getPrimarySource } from '../src/domain/canonicalManga.ts';
import { mergeCanonicalProgress } from '../src/domain/canonicalProgress.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('canonical search merges provider duplicates into one Manga Wave result', () => {
  const results = canonicalizeMangaCandidates([
    { provider: 'mangadex', externalId: 'dex', title: 'Solo Leveling', language: 'multi', detailUrl: '/manga/dex?source=mangadex' },
    { provider: 'originmanga', externalId: 'origin', title: 'SOLO-LEVELING', language: 'fr', detailUrl: '/manga/origin?source=originmanga' },
    { provider: 'comick', externalId: 'comick', title: 'Solo Leveling', language: 'en', detailUrl: '/manga/comick?source=comick' },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].sources.length, 3);
});

test('automatic read target prefers a readable source compatible with French', () => {
  const [manga] = canonicalizeMangaCandidates([
    { provider: 'english', externalId: 'en', title: 'One Piece', language: 'en', detailUrl: '/manga/en?source=english' },
    { provider: 'french', externalId: 'fr', title: 'One Piece', language: 'fr-FR', detailUrl: '/manga/fr?source=french' },
  ]);

  assert.equal(getPrimarySource(manga, 'fr')?.provider, 'french');
});

test('continue reading keeps one canonical entry after a provider switch', () => {
  const merged = mergeCanonicalProgress([
    { mangaTitle: 'Tower of God', readAt: '2026-01-01T10:00:00.000Z', source: 'one' },
    { mangaTitle: 'Tower-of-God', readAt: '2026-01-02T10:00:00.000Z', source: 'two' },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'two');
});

test('discovery surfaces do not present providers as the primary UX', () => {
  const homepage = read('src/pages/Index.tsx');
  const search = read('src/pages/Search.tsx');
  const continueReading = read('src/components/ContinueReadingSection.tsx');
  const library = read('src/pages/Library.tsx');

  assert.doesNotMatch(homepage, /MultiSourceHubSection/);
  assert.doesNotMatch(search, /Quick source pills|MOTEUR MULTI-SOURCES|Recherche <span className="glow-text">Multi-Sources/);
  assert.match(search, /Options avancées · Choisir une source/);
  assert.doesNotMatch(continueReading, /SOURCE_LABELS|sourceLabel/);
  assert.doesNotMatch(library, /SOURCE_BADGES|const badge =/);
});

test('Manga Detail keeps source selection secondary and reading immediate', () => {
  const detail = read('src/pages/MangaDetail.tsx');
  const overview = detail.slice(detail.indexOf('{/* MANGA OVERVIEW SECTION */}'), detail.indexOf('{sourcesOpen &&'));

  assert.match(overview, /Commencer la lecture/);
  assert.match(overview, /Changer de source/);
  assert.match(overview, /aria-expanded=\{sourcesOpen\}/);
  assert.doesNotMatch(overview, /\{manga\.sourceName\}/);
});

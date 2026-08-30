import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveCanonicalDetail } from '../src/domain/canonicalDetailResolution.ts';
import { buildCanonicalProgressSnapshot, mergeCanonicalProgress } from '../src/domain/canonicalProgress.ts';
import { buildReaderLocation } from '../src/domain/readerNavigation.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('source-less canonical detail falls through from a failed source to a healthy source', async () => {
  const attempted: string[] = [];
  const resolved = await resolveCanonicalDetail([
    { sourceId: 'mangadex', sourceMangaId: 'broken', eligible: true, sourceScore: 90 },
    { sourceId: 'originmanga', sourceMangaId: 'healthy', eligible: true, sourceScore: 80 },
  ], async (candidate) => {
    attempted.push(candidate.sourceId);
    if (candidate.sourceId === 'mangadex') throw new Error('provider unavailable');
    return { title: 'Solo Leveling' };
  });

  assert.deepEqual(attempted, ['mangadex', 'originmanga']);
  assert.equal(resolved.candidate.sourceId, 'originmanga');
  assert.equal(resolved.value.title, 'Solo Leveling');
});

test('Manga Detail has no hidden MangaDex default and Homepage uses canonical ids', () => {
  const detail = read('src/pages/MangaDetail.tsx');
  const homepage = read('src/components/HomeCatalogSections.tsx');
  const featured = read('src/components/FeaturedSection.tsx');

  assert.doesNotMatch(detail, /searchParams\.get\('source'\) \|\| 'mangadex'/);
  assert.match(detail, /useCanonicalMangaEntry\(requestedSource \? undefined : routeId/);
  assert.match(homepage, /detailUrl=\{`\/manga\/\$\{manga\.id\}`\}/);
  assert.match(featured, /detailUrl=\{`\/manga\/\$\{manga\.id\}`\}/);
});

test('Page 2 produces an immediately eligible canonical progress snapshot', () => {
  const snapshot = buildCanonicalProgressSnapshot({
    mangaTitle: 'Solo Leveling',
    source: 'asurascans',
    mangaId: 'solo-leveling',
    chapterId: 'chapter-5',
    pageIndex: 1,
    totalPages: 26,
  }, '2026-08-30T10:00:00.000Z');

  assert.equal(snapshot.pageIndex, 1);
  assert.equal(snapshot.totalPages, 26);
  assert.equal(snapshot.progressPercent, 8);
  assert.equal(snapshot.canonicalKey, 'title:solo leveling');
});

test('Continue Reading remains one canonical entry and resumes the saved page', () => {
  const items = mergeCanonicalProgress([
    { mangaTitle: 'Solo Leveling', source: 'mangadex', readAt: '2026-08-30T09:00:00.000Z' },
    { mangaTitle: 'Solo-Leveling', source: 'asurascans', readAt: '2026-08-30T10:00:00.000Z' },
  ]);
  const resume = buildReaderLocation({
    source: 'asurascans',
    mangaId: 'solo-leveling',
    chapterId: 'chapter-5',
    language: 'en',
    pageIndex: 1,
    mangaTitle: 'Solo Leveling',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'asurascans');
  assert.match(resume, /\/read\/asurascans\/solo-leveling\/chapter-5\?/);
  assert.match(resume, /page=1/);
  assert.match(resume, /title=Solo\+Leveling/);
});

test('progress wiring is immediate, canonical and not suppressed by auth hydration', () => {
  const progress = read('src/hooks/useReadingProgress.ts');
  const reader = read('src/pages/Reader.tsx');
  const homepage = read('src/pages/Index.tsx');

  assert.match(progress, /pendingRef\.current = item;[\s\S]*flushLocal\(\);/);
  assert.match(progress, /canonical_manga_id: canonicalMangaId/);
  assert.match(progress, /rpc\('find_canonical_manga'/);
  assert.match(progress, /invalidateQueries\(\{ queryKey: \['continue-reading-universal'\] \}\)/);
  assert.match(reader, /searchParams\.get\('title'\)/);
  assert.match(homepage, /loading \? \([\s\S]*\) : user \? \([\s\S]*<ContinueReadingSection \/>/);
});

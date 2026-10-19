import assert from 'node:assert/strict';
import test from 'node:test';
import { findMangaResumeProgress } from '../src/domain/mangaResume.ts';

const progress = (overrides: Record<string, unknown> = {}) => ({
  canonicalKey: 'title:solo leveling',
  canonicalMangaId: 42,
  mangaTitle: 'Solo Leveling',
  readAt: '2026-10-18T12:00:00Z',
  source: 'originmanga',
  mangaId: 'solo-leveling',
  chapterId: 'chapter-12',
  chapterNumber: '12',
  pageIndex: 7,
  totalPages: 20,
  progressPercent: 40,
  ...overrides,
});

test('canonical id identifies saved progress before title fallback', () => {
  const exact = progress({ mangaTitle: 'Titre fournisseur' });
  const titleOnly = progress({ canonicalMangaId: 99, readAt: '2026-10-19T12:00:00Z' });
  assert.equal(findMangaResumeProgress([titleOnly, exact], {
    canonicalMangaId: 42,
    title: 'Solo Leveling',
  }), exact);
});

test('normalized canonical title supports anonymous and legacy progress', () => {
  const legacy = progress({ canonicalKey: undefined, canonicalMangaId: null, mangaTitle: 'SÓLO   Leveling' });
  assert.equal(findMangaResumeProgress([legacy], { title: 'solo leveling' }), legacy);
});

test('the newest matching snapshot is selected deterministically', () => {
  const older = progress({ readAt: '2026-10-17T12:00:00Z' });
  const newer = progress({ readAt: '2026-10-19T12:00:00Z', chapterNumber: '14' });
  assert.equal(findMangaResumeProgress([older, newer], { canonicalMangaId: 42, title: 'Solo Leveling' }), newer);
});

test('unrelated progress is never offered', () => {
  assert.equal(findMangaResumeProgress([
    progress({ canonicalMangaId: 9 }),
  ], { canonicalMangaId: 42, title: 'Solo Leveling' }), null);
});

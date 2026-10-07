import type { SearchWork } from './canonicalSearch.ts';
export type FeaturedWork = { work: SearchWork; badge: 'Tendance' | 'Découverte' };
/** Canonical IDs only; provider ordering never implies popularity. */
export function selectFeaturedWorks(works: SearchWork[], trendingIds: number[], limit = 7): FeaturedWork[] {
  const candidates = new Map(works.filter((work) => Number.isSafeInteger(work.id) && work.id > 0
    && work.title.trim() && work.cover_image && work.content_rating !== 'erotica').map((work) => [work.id, work]));
  const selected: FeaturedWork[] = [];
  for (const id of trendingIds) {
    const work = candidates.get(id);
    if (!work) continue;
    selected.push({ work, badge: 'Tendance' }); candidates.delete(id);
  }
  const discoveries = [...candidates.values()].sort((a, b) =>
    (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || a.id - b.id);
  return [...selected, ...discoveries.map((work): FeaturedWork => ({ work, badge: 'Découverte' }))].slice(0, Math.max(0, limit));
}
export function slideOffset(index: number, active: number, count: number): number {
  if (!count) return 0;
  const forward = (index - active + count) % count;
  return forward > count / 2 ? forward - count : forward;
}

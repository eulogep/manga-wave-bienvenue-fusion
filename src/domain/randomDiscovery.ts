import type { SearchWork } from './canonicalSearch';

export const randomTypes = ['', 'manga', 'manhwa', 'manhua'] as const;
export const randomStatuses = ['', 'ongoing', 'completed', 'hiatus', 'cancelled'] as const;

export type RandomFilters = {
  type: typeof randomTypes[number];
  status: typeof randomStatuses[number];
};

export function parseRandomFilters(params: URLSearchParams): RandomFilters {
  const type = params.get('type');
  const status = params.get('status');
  return {
    type: randomTypes.includes(type as RandomFilters['type']) ? type as RandomFilters['type'] : '',
    status: randomStatuses.includes(status as RandomFilters['status']) ? status as RandomFilters['status'] : '',
  };
}

export function eligibleRandomWorks(works: SearchWork[], filters: RandomFilters): SearchWork[] {
  return [...new Map(works.map((work) => [work.id, work])).values()].filter((work) =>
    Boolean(work.title.trim())
    && (!filters.type || work.manga_type === filters.type)
    && (!filters.status || work.status === filters.status),
  );
}

export function selectRandomWork(
  works: SearchWork[],
  filters: RandomFilters,
  currentId?: number,
  random: () => number = Math.random,
): SearchWork | null {
  const eligible = eligibleRandomWorks(works, filters);
  const pool = eligible.length > 1 && currentId !== undefined
    ? eligible.filter((work) => work.id !== currentId)
    : eligible;
  if (!pool.length) return null;
  const value = random();
  const bounded = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1 - Number.EPSILON) : 0;
  return pool[Math.floor(bounded * pool.length)];
}

export function browserRandom(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 0x1_0000_0000;
  }
  return Math.random();
}

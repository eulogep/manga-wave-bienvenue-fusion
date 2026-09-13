export type SearchWork = {
  id: number;
  title: string;
  aliases: string[];
  author: string | null;
  genre: string[];
  manga_type: string | null;
  status: string;
  cover_image: string | null;
  rating: number | null;
  views: number;
  created_at: string;
  content_rating: string | null;
};
export const searchTypes = ['manga', 'manhwa', 'manhua'] as const;
export const searchStatuses = ['ongoing', 'completed', 'hiatus', 'cancelled'] as const;
export const searchSorts = ['relevance', 'popularity', 'rating', 'recent', 'az'] as const;
export type SearchState = {
  q: string;
  type: '' | typeof searchTypes[number];
  status: '' | typeof searchStatuses[number];
  genre: string;
  sort: typeof searchSorts[number];
  page: number;
  // True when the visitor asked to browse the full catalogue directly (e.g.
  // a "Voir tout" link) rather than search or filter it. Kept distinct from
  // the filters below so clearing filters doesn't also leave the page blank.
  browse: boolean;
};
export const SEARCH_PAGE_SIZE = 24;
export const normalizeQuery = (value: string) => value.normalize('NFKD')
  .replace(/\p{M}/gu, '').toLocaleLowerCase('en-US')
  .replace(/['’]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

export function parseSearchState(params: URLSearchParams): SearchState {
  const allowed = <T extends string>(value: string | null, values: readonly T[], fallback: T): T =>
    values.includes(value as T) ? value as T : fallback;
  const rawPage = Number(params.get('page') || 1);
  return {
    q: (params.get('q') || '').trim().slice(0, 160),
    type: allowed(params.get('type'), ['', ...searchTypes], ''),
    status: allowed(params.get('status'), ['', ...searchStatuses], ''),
    genre: (params.get('genre') || '').trim().slice(0, 80),
    sort: allowed(params.get('sort'), searchSorts, 'relevance'),
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    browse: params.get('browse') === '1',
  };
}
export function serializeSearchState(state: SearchState) {
  const params = new URLSearchParams();
  for (const key of ['q', 'type', 'status', 'genre'] as const) if (state[key]) params.set(key, state[key]);
  if (state.sort !== 'relevance') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  if (state.browse) params.set('browse', '1');
  return params;
}

// At most two edits, no fuzzy matching for short queries, and no unbounded DP table.
function editDistance(left: string, right: string, budget: number): number {
  const a = Array.from(left), b = Array.from(right);
  if (Math.abs(a.length - b.length) > budget) return budget + 1;
  let previous = b.map((_, i) => i + 1); previous.unshift(0);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (Math.min(...row) > budget) return budget + 1;
    previous = row;
  }
  return previous[b.length];
}
function fuzzyScore(title: string, query: string) {
  if (query.length < 5 || query.length > 160) return 0;
  const budget = query.length >= 10 ? 2 : 1;
  const words = title.split(' '), count = query.split(' ').length;
  // Match full title or a contiguous phrase: supports "omnicient reader" in a longer title.
  const phrases = [title, ...words.map((_, i) => words.slice(i, i + count).join(' '))];
  for (const phrase of phrases) {
    const distance = editDistance(query, phrase, budget);
    if (distance <= budget && 1 - distance / Math.max(query.length, phrase.length) >= 0.8) return 200 - distance;
  }
  return 0;
}
export function scoreSearchResult(work: SearchWork, rawQuery: string): number {
  const query = normalizeQuery(rawQuery);
  if (!query) return 0;
  const title = normalizeQuery(work.title), aliases = (work.aliases || []).map(normalizeQuery).filter(Boolean);
  if (title === query) return 800;
  if (aliases.includes(query)) return 700;
  if (title.startsWith(query)) return 600;
  if (aliases.some(alias => alias.startsWith(query))) return 500;
  if (title.includes(query)) return 400;
  if (aliases.some(alias => alias.includes(query))) return 300;
  const fuzzy = Math.max(fuzzyScore(title, query), ...aliases.map(alias => fuzzyScore(alias, query)));
  if (fuzzy) return fuzzy;
  if (normalizeQuery(work.author || '').includes(query)) return 100;
  if ((work.genre || []).some(genre => normalizeQuery(genre) === query)) return 90;
  return 0;
}
export function filterSearchResults(works: SearchWork[], state: SearchState) {
  return works.filter(work => (!state.type || normalizeQuery(work.manga_type || '') === state.type)
    && (!state.status || work.status === state.status)
    && (!state.genre || (work.genre || []).some(genre => normalizeQuery(genre) === normalizeQuery(state.genre))));
}
export function sortSearchResults(results: Array<{ work: SearchWork; score: number }>, sort: SearchState['sort']) {
  return [...results].sort((a, b) => {
    let difference = 0;
    if (sort === 'relevance') difference = b.score - a.score;
    if (sort === 'popularity') difference = (b.work.views || 0) - (a.work.views || 0);
    if (sort === 'rating') difference = (b.work.rating ?? -1) - (a.work.rating ?? -1);
    if (sort === 'recent') difference = (Date.parse(b.work.created_at) || 0) - (Date.parse(a.work.created_at) || 0);
    return difference || a.work.title.localeCompare(b.work.title, 'fr') || a.work.id - b.work.id;
  });
}
export function searchCanonicalWorks(works: SearchWork[], state: SearchState) {
  // Database identity is authoritative. Never fuzzy-merge separate works, sequels or aliases.
  const unique = [...new Map(works.map(work => [work.id, work])).values()];
  const filtered = filterSearchResults(unique, state);
  const hasQuery = Boolean(normalizeQuery(state.q));
  return sortSearchResults(filtered.map(work => ({ work, score: scoreSearchResult(work, state.q) }))
    .filter(result => !hasQuery || result.score > 0), state.sort).map(result => result.work);
}

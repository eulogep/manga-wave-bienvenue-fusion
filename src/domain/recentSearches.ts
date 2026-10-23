import { normalizeQuery } from './canonicalSearch.ts';

export const MAX_RECENT_SEARCHES = 8;
export const MIN_RECENT_SEARCH_LENGTH = 2;
export const MAX_RECENT_SEARCH_LENGTH = 160;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

/**
 * Puts a committed query first, removing earlier entries that normalize to the
 * same search ("One Piece" and "one  piece") and keeping the list bounded.
 * Too-short queries are ignored so stray keystrokes never pollute the history.
 */
export function addRecentSearch(current: string[], query: string): string[] {
  const value = collapseWhitespace(query).slice(0, MAX_RECENT_SEARCH_LENGTH);
  const key = normalizeQuery(value);
  if (key.length < MIN_RECENT_SEARCH_LENGTH) return current;
  return [value, ...current.filter((entry) => normalizeQuery(entry) !== key)].slice(0, MAX_RECENT_SEARCHES);
}

export function removeRecentSearch(current: string[], query: string): string[] {
  const key = normalizeQuery(query);
  return current.filter((entry) => normalizeQuery(entry) !== key);
}

/** Reads stored history defensively: anything that is not a list of strings is dropped. */
export function parseRecentSearches(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .reduceRight<string[]>((list, entry) => addRecentSearch(list, entry), []);
  } catch {
    return [];
  }
}

/** Recent searches that extend what is being typed, most recent first. */
export function matchRecentSearches(recent: string[], draft: string, limit = 4): string[] {
  const key = normalizeQuery(draft);
  if (!key) return recent.slice(0, limit);
  return recent.filter((entry) => {
    const entryKey = normalizeQuery(entry);
    return entryKey !== key && entryKey.includes(key);
  }).slice(0, limit);
}

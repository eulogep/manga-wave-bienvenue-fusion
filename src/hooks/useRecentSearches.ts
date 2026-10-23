import { useCallback, useEffect, useState } from 'react';
import { addRecentSearch, parseRecentSearches, removeRecentSearch } from '@/domain/recentSearches';

const STORAGE_KEY = 'mw-recent-searches';
const EVENT_NAME = 'mw-recent-searches-changed';

function readRecentSearches(): string[] {
  try {
    return parseRecentSearches(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage blocked (private browsing, disabled site data): no history.
    return [];
  }
}

function writeRecentSearches(next: string[]) {
  try {
    if (next.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the history simply is not remembered.
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

/**
 * Recent committed searches, kept only in this browser and never sent to the
 * server. Synced across mounted components (custom event) and other tabs
 * (native `storage` event), like useAdultConfirmation.
 */
export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);

  useEffect(() => {
    const sync = () => setRecentSearches(readRecentSearches());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const recordSearch = useCallback((query: string) => {
    const current = readRecentSearches();
    const next = addRecentSearch(current, query);
    if (next !== current) writeRecentSearches(next);
  }, []);

  const removeSearch = useCallback((query: string) => {
    writeRecentSearches(removeRecentSearch(readRecentSearches(), query));
  }, []);

  const clearSearches = useCallback(() => writeRecentSearches([]), []);

  return { recentSearches, recordSearch, removeSearch, clearSearches };
}

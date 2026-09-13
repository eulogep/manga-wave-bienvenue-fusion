import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mw-adult-confirmed';
const EVENT_NAME = 'mw-adult-confirmed-changed';

function readConfirmed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Private browsing / storage blocked: treat as not yet confirmed rather
    // than throwing — the gate degrades to "ask every time" instead of
    // breaking the page.
    return false;
  }
}

/**
 * Only 'erotica' is treated as adult content requiring confirmation —
 * matches src/domain/contentRating.ts and MangaDex's own rating scale.
 * 'suggestive' (fanservice, non-explicit) is intentionally left unblurred,
 * same as most manga platforms.
 */
export function isAdultContentRating(contentRating: string | null | undefined): boolean {
  return contentRating === 'erotica';
}

/**
 * Tracks whether this visitor has confirmed being 18+ at least once on this
 * browser. Persisted in localStorage — confirmed once, never asked again on
 * this device — and kept in sync across every mounted component via a
 * same-tab custom event (the native `storage` event only fires in *other*
 * tabs, not the one that made the change).
 */
export function useAdultConfirmation() {
  const [confirmed, setConfirmed] = useState(readConfirmed);

  useEffect(() => {
    const sync = () => setConfirmed(readConfirmed());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const confirm = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Storage unavailable: the in-memory state below still unblocks this
      // page load, it just won't be remembered next visit.
    }
    setConfirmed(true);
    window.dispatchEvent(new Event(EVENT_NAME));
  }, []);

  return { confirmed, confirm };
}

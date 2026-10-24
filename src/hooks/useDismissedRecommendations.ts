import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'mw-dismissed-recommendations';
const EVENT_NAME = 'mw-dismissed-recommendations-changed';
/** Oldest dismissals fall off first, so storage stays small. */
export const MAX_DISMISSED_RECOMMENDATIONS = 200;

function readDismissed(): number[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isSafeInteger(id)) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: number[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-MAX_DISMISSED_RECOMMENDATIONS)));
  } catch {
    // Storage unavailable: the dismissal lasts for this visit only.
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

/** "Pas intéressé" choices, kept on this device only and never sent to the server. */
export function useDismissedRecommendations() {
  const [ids, setIds] = useState(readDismissed);

  useEffect(() => {
    const sync = () => setIds(readDismissed());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    const current = readDismissed().filter((entry) => entry !== id);
    writeDismissed([...current, id]);
    setIds(readDismissed());
  }, []);

  const restore = useCallback((id: number) => {
    writeDismissed(readDismissed().filter((entry) => entry !== id));
    setIds(readDismissed());
  }, []);

  const dismissed = useMemo(() => new Set(ids), [ids]);
  return { dismissed, dismiss, restore };
}

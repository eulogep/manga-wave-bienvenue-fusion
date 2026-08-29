import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ReaderMode = 'vertical' | 'webtoon' | 'single_page' | 'double_page' | 'manga_rtl' | 'comic_ltr';
export type ReaderFitMode = 'width' | 'height' | 'original';
export type ReaderBackground = 'ink' | 'night' | 'paper';
export type ReadingDirection = 'rtl' | 'ltr';

export type ReaderPreferences = {
  mode: ReaderMode;
  fitMode: ReaderFitMode;
  zoom: number;
  pageGap: number;
  background: ReaderBackground;
  brightness: number;
  preloadCount: number;
  readingDirection: ReadingDirection;
};

const STORAGE_KEY = 'manga_wave_reader_preferences_v3';

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  mode: 'single_page',
  fitMode: 'width',
  zoom: 1,
  pageGap: 8,
  background: 'ink',
  brightness: 1,
  preloadCount: 3,
  readingDirection: 'rtl',
};

const MODES = new Set<ReaderMode>(['vertical', 'webtoon', 'single_page', 'double_page', 'manga_rtl', 'comic_ltr']);
const FIT_MODES = new Set<ReaderFitMode>(['width', 'height', 'original']);
const BACKGROUNDS = new Set<ReaderBackground>(['ink', 'night', 'paper']);

const clamp = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : fallback;
};

function normalizePreferences(value: Partial<ReaderPreferences> | null | undefined): ReaderPreferences {
  return {
    mode: value?.mode && MODES.has(value.mode) ? value.mode : DEFAULT_READER_PREFERENCES.mode,
    fitMode: value?.fitMode && FIT_MODES.has(value.fitMode) ? value.fitMode : DEFAULT_READER_PREFERENCES.fitMode,
    zoom: clamp(value?.zoom, 0.5, 2, DEFAULT_READER_PREFERENCES.zoom),
    pageGap: Math.round(clamp(value?.pageGap, 0, 48, DEFAULT_READER_PREFERENCES.pageGap)),
    background: value?.background && BACKGROUNDS.has(value.background)
      ? value.background
      : DEFAULT_READER_PREFERENCES.background,
    brightness: clamp(value?.brightness, 0.5, 1.25, DEFAULT_READER_PREFERENCES.brightness),
    preloadCount: Math.round(clamp(value?.preloadCount, 1, 8, DEFAULT_READER_PREFERENCES.preloadCount)),
    readingDirection: value?.readingDirection === 'ltr' ? 'ltr' : 'rtl',
  };
}

function readLocalPreferences(): ReaderPreferences {
  try {
    return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return DEFAULT_READER_PREFERENCES;
  }
}

function writeLocalPreferences(preferences: ReaderPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error: unknown) {
    console.warn('Préférences lecteur non sauvegardées localement :', error);
  }
}

export function useReaderPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<ReaderPreferences>(readLocalPreferences);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('user_reader_preferences')
      .select('reading_mode, fit_mode, zoom, page_gap, background, brightness, preload_count, reading_direction')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const remote = normalizePreferences({
          mode: data.reading_mode as ReaderMode,
          fitMode: data.fit_mode as ReaderFitMode,
          zoom: data.zoom,
          pageGap: data.page_gap,
          background: data.background as ReaderBackground,
          brightness: data.brightness,
          preloadCount: data.preload_count,
          readingDirection: data.reading_direction as ReadingDirection,
        });
        writeLocalPreferences(remote);
        setPreferences(remote);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => () => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
  }, []);

  const updatePreferences = useCallback((changes: Partial<ReaderPreferences>) => {
    setPreferences((current) => {
      const next = normalizePreferences({ ...current, ...changes });
      writeLocalPreferences(next);

      if (user) {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
          supabase.from('user_reader_preferences').upsert({
            user_id: user.id,
            reading_mode: next.mode,
            fit_mode: next.fitMode,
            zoom: next.zoom,
            page_gap: next.pageGap,
            background: next.background,
            brightness: next.brightness,
            preload_count: next.preloadCount,
            reading_direction: next.readingDirection,
          }).then(({ error }) => {
            if (error) console.warn('Préférences lecteur non synchronisées :', error.message);
          });
        }, 600);
      }
      return next;
    });
  }, [user]);

  const resetPreferences = useCallback(() => updatePreferences(DEFAULT_READER_PREFERENCES), [updatePreferences]);

  return { preferences, updatePreferences, resetPreferences };
}

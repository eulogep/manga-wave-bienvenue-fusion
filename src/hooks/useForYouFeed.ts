import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { useFollows } from '@/hooks/useFollows';
import { useReadingSessions } from '@/hooks/useReadingStats';
import { useTrendingRanking } from '@/hooks/useTrending';
import { useUserLists } from '@/hooks/useUserLists';
import { useDismissedRecommendations } from '@/hooks/useDismissedRecommendations';
import { isChapterFinished } from '@/domain/readingStats';
import { buildForYouFeed, dailySeed, type FeedSignal, type FeedSignalKind } from '@/domain/forYouFeed';

// ---- Device-local feed state: feed reactions, impressions, onboarding, refreshes ----

type LocalFeedState = {
  events: FeedSignal[];
  impressions: Record<string, number>;
  onboardingGenres: string[];
  refresh: number;
};

const STORAGE_KEY = 'mw-for-you-feed';
const EVENT_NAME = 'mw-for-you-feed-changed';
const MAX_EVENTS = 400;
const EMPTY_STATE: LocalFeedState = { events: [], impressions: {}, onboardingGenres: [], refresh: 0 };

function readState(): LocalFeedState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return EMPTY_STATE;
    return {
      events: Array.isArray(parsed.events)
        ? parsed.events.filter((event: FeedSignal) => Number.isSafeInteger(event?.mangaId) && typeof event?.kind === 'string' && typeof event?.at === 'string')
        : [],
      impressions: parsed.impressions && typeof parsed.impressions === 'object' ? parsed.impressions : {},
      onboardingGenres: Array.isArray(parsed.onboardingGenres) ? parsed.onboardingGenres.filter((genre: unknown) => typeof genre === 'string') : [],
      refresh: Number.isSafeInteger(parsed.refresh) ? parsed.refresh : 0,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(update: (state: LocalFeedState) => LocalFeedState) {
  const next = update(readState());
  next.events = next.events.slice(-MAX_EVENTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: reactions only shape this visit.
  }
  window.dispatchEvent(new Event(EVENT_NAME));
  return next;
}

/** Feed reactions kept on this device only; they never leave the browser. */
export function useLocalFeedState() {
  const [state, setState] = useState(readState);

  useEffect(() => {
    const sync = () => setState(readState());
    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const record = useCallback((mangaId: number, kind: Extract<FeedSignalKind, 'feed_like' | 'feed_open' | 'feed_skip'>) => {
    setState(writeState((current) => ({ ...current, events: [...current.events, { mangaId, kind, at: new Date().toISOString() }] })));
  }, []);

  const recordImpression = useCallback((mangaId: number) => {
    setState(writeState((current) => ({
      ...current,
      impressions: { ...current.impressions, [mangaId]: (current.impressions[mangaId] || 0) + 1 },
    })));
  }, []);

  const setOnboardingGenres = useCallback((genres: string[]) => {
    setState(writeState((current) => ({ ...current, onboardingGenres: genres })));
  }, []);

  const refresh = useCallback(() => {
    setState(writeState((current) => ({ ...current, refresh: current.refresh + 1 })));
  }, []);

  const reset = useCallback(() => {
    setState(writeState(() => EMPTY_STATE));
  }, []);

  return { state, record, recordImpression, setOnboardingGenres, refresh, reset };
}

// ---- Server-side signals the reader already owns (RLS-protected) ----

function useFavoriteSignals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['feed-favorites', user?.id],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async (): Promise<FeedSignal[]> => {
      if (!user) return [];
      const { data, error } = await supabase.from('user_favorites').select('manga_id, created_at').eq('user_id', user.id);
      if (error) throw error;
      return (data || []).map((row) => ({ mangaId: row.manga_id, kind: 'favorite' as const, at: row.created_at }));
    },
  });
}

const LIST_SIGNAL: Record<string, FeedSignalKind> = { to_read: 'list_to_read', completed: 'list_completed', on_hold: 'list_custom', custom: 'list_custom' };

export function useForYouFeed() {
  const { user } = useAuth();
  const catalog = useCanonicalSearch(true);
  const trending = useTrendingRanking();
  const local = useLocalFeedState();
  const { dismissed } = useDismissedRecommendations();
  const favorites = useFavoriteSignals();
  const follows = useFollows();
  const sessions = useReadingSessions();
  const lists = useUserLists();

  const signals = useMemo((): FeedSignal[] => {
    const now = new Date().toISOString();
    const listKind = new Map(lists.lists.map((list) => [list.id, list.kind]));
    return [
      ...local.state.events,
      ...[...dismissed].map((mangaId) => ({ mangaId, kind: 'dismiss' as const, at: now })),
      ...(user ? favorites.data || [] : []),
      ...(user ? (follows.data || []).map((follow) => ({ mangaId: follow.canonicalMangaId, kind: 'follow' as const, at: follow.createdAt })) : []),
      ...(user ? (sessions.data || []).map((session) => ({
        mangaId: session.canonical_manga_id,
        kind: isChapterFinished(session) ? 'chapter_finished' as const : 'reading_session' as const,
        at: session.read_at,
      })) : []),
      ...(user ? lists.items.map((item) => ({ mangaId: item.canonicalMangaId, kind: LIST_SIGNAL[listKind.get(item.listId) || 'custom'], at: item.createdAt || now })) : []),
    ];
  }, [local.state.events, dismissed, user, favorites.data, follows.data, sessions.data, lists.lists, lists.items]);

  const trendingScores = useMemo(() => new Map(trending.items.map((item) => [item.work.id, item.score])), [trending.items]);
  const impressions = useMemo(
    () => new Map(Object.entries(local.state.impressions).map(([id, count]) => [Number(id), count])),
    [local.state.impressions],
  );

  // The day's seed changes on refresh; signals are re-read live, so the feed adapts mid-session.
  const feed = useMemo(() => (catalog.data ? buildForYouFeed({
    catalog: catalog.data,
    signals,
    trending: trendingScores,
    onboardingGenres: local.state.onboardingGenres,
    impressions,
    seed: dailySeed(new Date(), local.state.refresh),
  }) : []), [catalog.data, signals, trendingScores, local.state.onboardingGenres, impressions, local.state.refresh]);

  const personalSignalsPending = Boolean(user) && (favorites.isPending || follows.isPending || sessions.isPending);

  return {
    feed,
    isPending: catalog.isPending || personalSignalsPending,
    isError: catalog.isError,
    refetch: catalog.refetch,
    hasPersonalSignals: signals.some((signal) => signal.kind !== 'feed_skip') || local.state.onboardingGenres.length > 0,
    local,
  };
}

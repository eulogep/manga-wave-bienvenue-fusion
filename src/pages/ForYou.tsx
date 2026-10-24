import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Heart, RefreshCw, Sparkles, ThumbsDown } from 'lucide-react';
import Header from '@/components/Header';
import MangaCover from '@/components/MangaCover';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useManga';
import { useToast } from '@/hooks/use-toast';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { useDismissedRecommendations } from '@/hooks/useDismissedRecommendations';
import { useForYouFeed } from '@/hooks/useForYouFeed';
import { formatDocumentTitle } from '@/domain/documentMetadata';
import { discoveryStatusLabel } from '@/domain/discoveryPresentation';
import { feedReasonLabel, type FeedItem } from '@/domain/forYouFeed';
import { genreLabel, GENRE_LABELS } from '@/domain/genres';

const PAGE_SIZE = 8;
/** A card counts as seen after this long on screen. */
const IMPRESSION_MS = 1500;
const ONBOARDING_GENRES = ['Action', 'Romance', 'Fantasy', 'Isekai', 'Comedy', 'Drama', 'Slice of Life', 'Horror', 'Sci-Fi', 'Psychological', 'Adventure', 'Sports'];

function useSynopses(ids: number[]) {
  return useQuery({
    queryKey: ['feed-synopses', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('mangas').select('id, description').in('id', ids);
      if (error) throw error;
      return new Map((data || []).map((row) => [row.id, row.description as string | null]));
    },
  });
}

const OnboardingCard = ({ onDone }: { onDone: (genres: string[]) => void }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (genre: string) => setPicked((current) => (current.includes(genre) ? current.filter((entry) => entry !== genre) : [...current, genre]));
  return (
    <section className="flex h-full snap-start items-center justify-center px-5" aria-labelledby="onboarding-title">
      <div className="max-w-xl text-center">
        <Sparkles className="mx-auto mb-4 h-10 w-10 text-manga-cyan" aria-hidden="true" />
        <h2 id="onboarding-title" className="font-editorial text-3xl uppercase md:text-4xl">Qu’est-ce qui te fait vibrer ?</h2>
        <p className="mt-3 text-sm text-white/60">Choisis quelques genres : ton flux s’ajuste ensuite à chaque lecture, like ou « pas pour moi ».</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Genres préférés">
          {ONBOARDING_GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              aria-pressed={picked.includes(genre)}
              onClick={() => toggle(genre)}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${picked.includes(genre) ? 'border-[var(--mw-accent-coral)] bg-[var(--mw-accent-coral)]/20 text-white' : 'border-white/20 text-white/70 hover:text-white'}`}
            >
              {GENRE_LABELS[genre] || genre}
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Button className="btn-gradient rounded-full px-6" disabled={picked.length === 0} onClick={() => onDone(picked)}>C’est parti</Button>
          <Button variant="ghost" className="rounded-full text-white/60" onClick={() => onDone([])}>Passer</Button>
        </div>
      </div>
    </section>
  );
};

const FeedCard = ({ item, synopsis, liked, onOpen, onLike, onDismiss, onSeen, priority }: {
  item: FeedItem;
  synopsis: string | null | undefined;
  liked: boolean;
  onOpen: () => void;
  onLike: () => void;
  onDismiss: () => void;
  onSeen: (engaged: boolean) => void;
  priority: boolean;
}) => {
  const ref = useRef<HTMLElement>(null);
  const engaged = useRef(false);
  // Latest callback in a ref: the observer must survive re-renders to time impressions.
  const onSeenRef = useRef(onSeen);
  useEffect(() => { onSeenRef.current = onSeen; }, [onSeen]);
  const { work } = item;

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let visibleSince: number | null = null;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        visibleSince = Date.now();
      } else if (visibleSince !== null) {
        if (Date.now() - visibleSince >= IMPRESSION_MS) onSeenRef.current(engaged.current);
        visibleSince = null;
      }
    }, { threshold: 0.6 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const act = (action: () => void) => () => { engaged.current = true; action(); };

  return (
    <article ref={ref} data-feed-card={work.id} className="relative flex h-full snap-start items-end overflow-hidden md:items-center" aria-label={work.title}>
      <div className="absolute inset-0 scale-110 opacity-40 blur-2xl" aria-hidden="true">
        <MangaCover src={work.cover_image} alt="" className="h-full w-full object-cover" deferProxy />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#06101a] via-[#06101a]/70 to-[#06101a]/30" aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-5xl gap-6 px-5 pb-8 md:grid-cols-[minmax(0,320px)_1fr] md:items-center md:pb-0">
        <Link to={`/manga/${work.id}`} onClick={act(onOpen)} className="mx-auto block w-44 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 md:w-full" aria-label={`Ouvrir la fiche de ${work.title}`}>
          <MangaCover src={work.cover_image} alt={`Couverture de ${work.title}`} className="aspect-[3/4] h-full w-full object-cover" loading={priority ? 'eager' : 'lazy'} />
        </Link>
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-manga-cyan">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {feedReasonLabel(item.reason, genreLabel)}
          </p>
          <h2 className="mt-3 font-editorial text-3xl uppercase leading-tight md:text-5xl">{work.title}</h2>
          <p className="mt-2 text-sm text-white/60">
            {[work.manga_type, discoveryStatusLabel(work.status), ...work.genre.slice(0, 3).map(genreLabel)].filter(Boolean).join(' · ')}
          </p>
          {synopsis && <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-6 text-white/75 md:line-clamp-4">{synopsis}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="btn-gradient rounded-full px-6">
              <Link to={`/manga/${work.id}`} onClick={act(onOpen)}>Découvrir</Link>
            </Button>
            <Button type="button" variant="outline" aria-pressed={liked} onClick={act(onLike)} className={`rounded-full border-white/25 ${liked ? 'bg-[var(--mw-accent-coral)]/20 text-white' : ''}`}>
              <Heart className={`mr-2 h-4 w-4 ${liked ? 'fill-current text-[var(--mw-accent-coral)]' : ''}`} aria-hidden="true" /> {liked ? 'Aimé' : 'J’aime'}
            </Button>
            <Button type="button" variant="ghost" onClick={act(onDismiss)} className="rounded-full text-white/60 hover:text-white">
              <ThumbsDown className="mr-2 h-4 w-4" aria-hidden="true" /> Pas pour moi
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
};

const ForYou = () => {
  useDocumentMetadata(formatDocumentTitle('Pour toi'), 'Un flux de mangas qui apprend de tes lectures, de tes likes et de tes « pas pour moi ».');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { toggleFavorite } = useFavorites();
  const { dismiss, restore } = useDismissedRecommendations();
  const { feed, isPending, isError, refetch, hasPersonalSignals, local } = useForYouFeed();
  const scroller = useRef<HTMLDivElement>(null);

  // Cards already shown stay put; only cards not yet shown benefit from live re-ranking.
  const [pinned, setPinned] = useState<FeedItem[]>([]);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const onboardingDecided = useRef(false);
  const refreshKey = local.state.refresh;

  useEffect(() => { setPinned([]); }, [refreshKey]);
  useEffect(() => {
    if (!isPending && pinned.length === 0 && feed.length) setPinned(feed.slice(0, PAGE_SIZE));
  }, [isPending, pinned.length, feed]);
  // Decide once, when signals are known: a reader with history never sees onboarding.
  useEffect(() => {
    if (isPending || onboardingDecided.current) return;
    onboardingDecided.current = true;
    setShowOnboarding(!hasPersonalSignals);
  }, [isPending, hasPersonalSignals]);

  const loadMore = useCallback(() => {
    setPinned((current) => {
      const shown = new Set(current.map((item) => item.work.id));
      return [...current, ...feed.filter((item) => !shown.has(item.work.id)).slice(0, PAGE_SIZE)];
    });
  }, [feed]);

  const visible = useMemo(() => pinned.filter((item) => !hidden.has(item.work.id)), [pinned, hidden]);
  const exhausted = useMemo(() => {
    const shown = new Set(pinned.map((item) => item.work.id));
    return pinned.length > 0 && feed.every((item) => shown.has(item.work.id));
  }, [pinned, feed]);
  const synopses = useSynopses(visible.slice(-PAGE_SIZE * 2).map((item) => item.work.id));

  // Infinite feed: load the next page when the second-to-last card comes into view.
  useEffect(() => {
    const root = scroller.current;
    const target = root?.querySelectorAll('[data-feed-card]')[Math.max(0, visible.length - 2)];
    if (!root || !target) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { root, threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible.length, loadMore]);

  const step = (direction: 1 | -1) => {
    const root = scroller.current;
    if (root) root.scrollBy({ top: direction * root.clientHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input, textarea, select, [role=dialog]')) return;
      if (event.key === 'ArrowDown' || event.key === 'j') { event.preventDefault(); step(1); }
      if (event.key === 'ArrowUp' || event.key === 'k') { event.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSeen = useCallback((mangaId: number, engaged: boolean) => {
    local.recordImpression(mangaId);
    if (!engaged) local.record(mangaId, 'feed_skip');
  }, [local]);

  const handleLike = async (item: FeedItem) => {
    if (liked.has(item.work.id)) return;
    setLiked((current) => new Set(current).add(item.work.id));
    local.record(item.work.id, 'feed_like');
    if (user) {
      try {
        await toggleFavorite.mutateAsync(item.work.id);
        toast({ title: 'Ajouté aux favoris', description: item.work.title });
      } catch {
        toast({ variant: 'destructive', title: 'Favori non enregistré', description: 'Ton like reste pris en compte pour ton flux.' });
      }
    }
  };

  const handleDismiss = (item: FeedItem) => {
    dismiss(item.work.id);
    setHidden((current) => new Set(current).add(item.work.id));
    toast({
      title: 'Compris, moins de titres comme celui-ci',
      description: item.work.title,
      action: <ToastAction altText={`Annuler et réafficher ${item.work.title}`} onClick={() => {
        restore(item.work.id);
        setHidden((current) => { const next = new Set(current); next.delete(item.work.id); return next; });
      }}>Annuler</ToastAction>,
    });
  };

  const finishOnboarding = (genres: string[]) => {
    local.setOnboardingGenres(genres);
    setShowOnboarding(false);
    local.refresh();
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-[#06101a] text-white">
      <Header />
      <h1 className="sr-only">Pour toi</h1>
      <div className="relative min-h-0 flex-1">
        {isPending ? (
          <div className="flex h-full items-center justify-center text-sm text-white/55" role="status">Préparation de ton flux…</div>
        ) : isError ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="text-white/70">Le catalogue n’a pas pu être chargé.</p>
            <Button className="btn-gradient" onClick={() => void refetch()}>Réessayer</Button>
          </div>
        ) : (
          <div ref={scroller} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain" data-testid="for-you-feed">
            {showOnboarding && <OnboardingCard onDone={finishOnboarding} />}
            {visible.map((item, index) => (
              <FeedCard
                key={`${refreshKey}-${item.work.id}`}
                item={item}
                synopsis={synopses.data?.get(item.work.id)}
                liked={liked.has(item.work.id)}
                priority={index < 2}
                onOpen={() => local.record(item.work.id, 'feed_open')}
                onLike={() => void handleLike(item)}
                onDismiss={() => handleDismiss(item)}
                onSeen={(engaged) => handleSeen(item.work.id, engaged)}
              />
            ))}
            {exhausted && (
              <section className="flex h-full snap-start flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-white/70">Tu as fait le tour du catalogue pour aujourd’hui.</p>
                <Button variant="outline" className="border-white/20" onClick={() => navigate('/collections')}>Explorer les collections</Button>
              </section>
            )}
          </div>
        )}
        <div className="pointer-events-none absolute right-4 top-4 flex flex-col gap-2 md:right-8">
          <Button type="button" size="icon" variant="outline" className="pointer-events-auto h-11 w-11 rounded-full border-white/20 bg-black/50" onClick={() => step(-1)} aria-label="Carte précédente"><ArrowUp className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="outline" className="pointer-events-auto h-11 w-11 rounded-full border-white/20 bg-black/50" onClick={() => step(1)} aria-label="Carte suivante"><ArrowDown className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="outline" className="pointer-events-auto h-11 w-11 rounded-full border-white/20 bg-black/50" onClick={() => { local.refresh(); scroller.current?.scrollTo({ top: 0 }); }} aria-label="Rafraîchir le flux"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
};

export default ForYou;

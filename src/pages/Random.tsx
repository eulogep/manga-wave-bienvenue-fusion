import { useCallback, useEffect, useMemo } from 'react';
import { Dices, RefreshCw, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MangaCover from '@/components/MangaCover';
import { Button } from '@/components/ui/button';
import { discoveryStatusLabel } from '@/domain/discoveryPresentation';
import {
  browserRandom,
  eligibleRandomWorks,
  parseRandomFilters,
  randomStatuses,
  randomTypes,
  selectRandomWork,
  type RandomFilters,
} from '@/domain/randomDiscovery';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';

const TYPE_LABELS: Record<string, string> = { manga: 'Manga', manhwa: 'Manhwa', manhua: 'Manhua' };
const STATUS_LABELS: Record<string, string> = {
  ongoing: 'En cours', completed: 'Terminé', hiatus: 'En pause', cancelled: 'Annulé',
};

const Random = () => {
  const [params, setParams] = useSearchParams();
  const catalog = useCanonicalSearch(true);
  const filters = useMemo(() => parseRandomFilters(params), [params]);
  const selectedId = Number(params.get('id'));
  const eligible = useMemo(
    () => eligibleRandomWorks(catalog.data || [], filters),
    [catalog.data, filters],
  );
  const selected = Number.isSafeInteger(selectedId)
    ? eligible.find((work) => work.id === selectedId) || null
    : null;

  const choose = useCallback((nextFilters: RandomFilters, replace = false) => {
    if (!catalog.data) return;
    const next = selectRandomWork(catalog.data, nextFilters, selected?.id, browserRandom);
    const nextParams = new URLSearchParams();
    if (nextFilters.type) nextParams.set('type', nextFilters.type);
    if (nextFilters.status) nextParams.set('status', nextFilters.status);
    if (next) nextParams.set('id', String(next.id));
    setParams(nextParams, { replace });
  }, [catalog.data, selected?.id, setParams]);

  useEffect(() => {
    if (catalog.data && !selected && eligible.length) choose(filters, true);
  }, [catalog.data, choose, eligible.length, filters, selected]);

  const changeFilter = (key: keyof RandomFilters, value: string) => {
    choose({ ...filters, [key]: value } as RandomFilters);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
      <Header />
      <main className="flex-1 section-padding py-10 md:py-14" data-testid="random-page">
        <div className="container mx-auto max-w-5xl">
          <header className="mb-8 max-w-2xl">
            <p className="text-manga-cyan font-semibold tracking-widest text-xs mb-2">DÉCOUVERTE</p>
            <h1 className="text-4xl md:text-5xl font-bold font-japanese mb-3">
              <span className="glow-text">Surprends-moi</span>
            </h1>
            <p className="text-white/55 text-sm md:text-base">
              Une œuvre tirée au hasard dans le catalogue canonique. Ajustez le format ou le statut,
              puis laissez la vague choisir.
            </p>
          </header>

          <section aria-label="Filtres de découverte aléatoire" className="mb-8 grid gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
              Format
              <select
                value={filters.type}
                onChange={(event) => changeFilter('type', event.target.value)}
                className="min-h-11 rounded-lg border border-white/10 bg-[#101925] px-3 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-[var(--mw-accent-coral)]"
                aria-label="Filtrer le tirage par format"
              >
                {randomTypes.map((type) => <option key={type || 'all'} value={type}>{type ? TYPE_LABELS[type] : 'Tous les formats'}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wider text-white/55">
              Statut
              <select
                value={filters.status}
                onChange={(event) => changeFilter('status', event.target.value)}
                className="min-h-11 rounded-lg border border-white/10 bg-[#101925] px-3 text-sm normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-[var(--mw-accent-coral)]"
                aria-label="Filtrer le tirage par statut"
              >
                {randomStatuses.map((status) => <option key={status || 'all'} value={status}>{status ? STATUS_LABELS[status] : 'Tous les statuts'}</option>)}
              </select>
            </label>
            <Button
              type="button"
              onClick={() => choose(filters)}
              disabled={catalog.isPending || eligible.length < 2}
              className="min-h-11 gap-2 bg-[var(--mw-accent-coral)] text-white hover:bg-[#ff6671]"
              data-testid="random-reroll"
            >
              <Dices className="h-4 w-4" aria-hidden="true" /> Une autre
            </Button>
          </section>

          {catalog.isPending ? (
            <div className="py-20 text-center text-white/55" role="status">
              <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin" aria-hidden="true" />
              La vague parcourt le catalogue…
            </div>
          ) : catalog.isError ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-8 text-center" role="alert">
              <p className="mb-4 text-white/75">Impossible de charger le catalogue canonique.</p>
              <Button onClick={() => catalog.refetch()} disabled={catalog.isFetching}>Réessayer</Button>
            </div>
          ) : selected ? (
            <article className="grid overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0d1622] shadow-[0_28px_80px_-36px_rgba(0,0,0,0.9)] md:grid-cols-[minmax(260px,0.72fr)_1.28fr]" data-testid={`random-result-${selected.id}`}>
              <div className="relative min-h-[420px] bg-[#101925]">
                <MangaCover src={selected.cover_image} alt={`Couverture de ${selected.title}`} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1622] via-transparent to-black/10 md:bg-gradient-to-r md:from-transparent md:to-[#0d1622]/20" />
              </div>
              <div className="flex flex-col justify-center p-7 md:p-10">
                <div className="mb-5 flex flex-wrap gap-2">
                  {selected.manga_type && TYPE_LABELS[selected.manga_type] ? <span className="rounded-full bg-manga-cyan/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-manga-cyan">{TYPE_LABELS[selected.manga_type]}</span> : null}
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white/65">{discoveryStatusLabel(selected.status)}</span>
                </div>
                <h2 className="font-japanese text-3xl font-bold leading-tight md:text-5xl">{selected.title}</h2>
                <p className="mt-3 text-sm text-white/50">{selected.author || 'Auteur non renseigné'}</p>
                {selected.genre?.length ? <p className="mt-5 text-sm leading-7 text-white/65">{selected.genre.slice(0, 6).join(' · ')}</p> : null}
                <p className="mt-8 text-xs uppercase tracking-widest text-white/35">1 œuvre parmi {eligible.length}</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="min-h-11 bg-white text-[#08111b] hover:bg-white/90">
                    <Link to={`/manga/${selected.id}`}>Découvrir cette œuvre</Link>
                  </Button>
                  <Button variant="outline" onClick={() => choose(filters)} disabled={eligible.length < 2} className="min-h-11 gap-2 border-white/15 bg-transparent text-white hover:bg-white/[0.06] hover:text-white">
                    <Dices className="h-4 w-4" aria-hidden="true" /> Relancer la vague
                  </Button>
                </div>
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-10 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-white/30" aria-hidden="true" />
              <h2 className="text-xl font-bold">Aucune œuvre pour ces filtres</h2>
              <p className="mt-2 text-sm text-white/50">Élargissez le format ou le statut pour reprendre le tirage.</p>
              <Button variant="outline" onClick={() => choose({ type: '', status: '' })} className="mt-5 min-h-11 border-white/15 bg-transparent text-white hover:bg-white/[0.06] hover:text-white">Réinitialiser les filtres</Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Random;

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, LayoutGrid, List, Search as SearchIcon, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CatalogueHero, CatalogueDiscovery, MoodRail } from '@/components/CatalogueDiscovery';
import EditorialMangaCard from '@/components/EditorialMangaCard';
import { useTrendingRanking } from '@/hooks/useTrending';
import { selectFeaturedWorks } from '@/domain/featuredManga';
import '@/components/Catalogue.css';
import { isAdultContentRating, useAdultConfirmation } from '@/hooks/useAdultConfirmation';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { normalizeQuery, parseSearchState, searchCanonicalWorks, serializeSearchState, SEARCH_PAGE_SIZE, type SearchState } from '@/domain/canonicalSearch';

const control = 'min-h-11 w-full min-w-0 rounded-md border border-slate-500 bg-[#101e2c] px-3 py-2 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300';
const statusLabels: Record<string, string> = { ongoing: 'En cours', completed: 'Terminé', hiatus: 'En pause', cancelled: 'Annulé' };
const Search = () => {
  const { confirmed: adultConfirmed } = useAdultConfirmation();
  const [params, setParams] = useSearchParams();
  const urlState = params.toString();
  const state = useMemo(() => parseSearchState(new URLSearchParams(urlState)), [urlState]);
  const [draft, setDraft] = useState(state.q);
  useEffect(() => { setDraft(state.q); }, [state.q]);
  useEffect(() => {
    if (draft.trim() === state.q) return;
    const timer = setTimeout(() => setParams(serializeSearchState({ ...state, q: draft.trim(), page: 1 }), { replace: true }), 250);
    return () => clearTimeout(timer);
  }, [draft, state, setParams]);
  const active = Boolean(normalizeQuery(state.q) || state.type || state.status || state.genre || state.browse);
  // The catalogue is public metadata (no per-user data), so loading it
  // eagerly lets genre categories render for browsing immediately, without
  // waiting for a first search or filter.
  const catalog = useCanonicalSearch(true);
  const results = useMemo(() => searchCanonicalWorks(catalog.data || [], active ? state : { ...state, browse: true }), [catalog.data, state, active]);
  const trending = useTrendingRanking();
  const discoveries = useMemo(() => selectFeaturedWorks(catalog.data || [], trending.confidence.confident ? trending.items.map(item => item.work.id) : []), [catalog.data, trending.items, trending.confidence.confident]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const genreCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const work of catalog.data || []) for (const genre of work.genre || []) counts.set(genre, (counts.get(genre) || 0) + 1);
    return counts;
  }, [catalog.data]);
  const genres = useMemo(() => [...genreCounts.keys()].sort((a, b) => a.localeCompare(b, 'fr')), [genreCounts]);
  const pages = Math.max(1, Math.ceil(results.length / SEARCH_PAGE_SIZE));
  const page = Math.min(state.page, pages);
  const change = (patch: Partial<SearchState>) => setParams(serializeSearchState({ ...state, q: draft.trim(), page: 1, ...patch }));
  const submit = (event: FormEvent) => { event.preventDefault(); change({ q: draft.trim() }); };
  const hasFilters = Boolean(state.type || state.status || state.genre);
  const browseAll = () => change({ browse: true, sort: 'recent' });
  return <div className="catalogue-page">
    <Header />
    <main data-testid="search-v2">
      <CatalogueHero featured={discoveries[0]} />
      <div className="catalogue-width">
        <form onSubmit={submit} className="catalogue-search-panel" aria-label="Recherche et filtres">
          <div className="catalogue-search-row">
            <label htmlFor="manga-search" className="catalogue-input-wrap">
              <SearchIcon size={22} aria-hidden="true" /><span className="sr-only">Rechercher un manga</span>
              <input id="manga-search" type="search" maxLength={160} placeholder="Titre, alias, auteur, genre…" value={draft} onChange={event => setDraft(event.target.value)} />
            </label>
            <button type="submit" className="catalogue-primary">Rechercher <ArrowRight size={18} /></button>
          </div>
          <div className="catalogue-filter-row">
            <label><span className="sr-only">Type</span><select value={state.type} onChange={event => change({ type: event.target.value as SearchState['type'] })}>
              <option value="">Tous les types</option><option value="manga">Manga</option><option value="manhwa">Manhwa</option><option value="manhua">Manhua</option>
            </select></label>
            <label><span className="sr-only">Statut</span><select value={state.status} onChange={event => change({ status: event.target.value as SearchState['status'] })}>
              <option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label><span className="sr-only">Genre</span><select id="catalogue-genre" value={state.genre} onChange={event => change({ genre: event.target.value })}>
              <option value="">Tous les genres</option>{[...new Set([...genres, ...(state.genre ? [state.genre] : [])])].sort().map(genre => <option key={genre} value={genre}>{genre}</option>)}
            </select></label>
            <label><span className="sr-only">Trier par</span><select value={state.sort} onChange={event => change({ sort: event.target.value as SearchState['sort'] })}>
              <option value="relevance">Pertinence</option><option value="popularity">Popularité</option><option value="rating">Note</option><option value="recent">Ajouts récents</option><option value="az">A–Z</option>
            </select></label>
          </div>
        </form>
        <div className="catalogue-layout">
          <MoodRail genres={genres} selected={state.genre} onChange={genre => change({ genre })} />
          <div className="catalogue-body">
            {!state.q && <CatalogueDiscovery items={discoveries} loading={catalog.isPending} />}
            <section aria-labelledby="canonical-results-title" aria-busy={catalog.isFetching} className="catalogue-results">
              <div className="catalogue-results-header">
                <div><p role="status">{catalog.isPending ? 'Chargement du catalogue…' : `${results.length} résultat${results.length > 1 ? 's' : ''}${state.q ? ` pour « ${state.q} »` : ''}`}</p>
                  <h2 id="canonical-results-title">Résultats Manga Wave</h2></div>
                <div className="catalogue-result-actions">
                  {hasFilters && <div className="catalogue-active-filters" aria-label="Filtres actifs">
                    {state.type && <button onClick={() => change({ type: '' })} aria-label={`Retirer le type ${state.type}`}>{state.type}<X size={14} /></button>}
                    {state.status && <button onClick={() => change({ status: '' })} aria-label={`Retirer le statut ${statusLabels[state.status]}`}>{statusLabels[state.status]}<X size={14} /></button>}
                    {state.genre && <button onClick={() => change({ genre: '' })} aria-label={`Retirer le genre ${state.genre}`}>{state.genre}<X size={14} /></button>}
                    <button aria-label="Effacer les filtres" onClick={() => change({ type: '', status: '', genre: '' })}>Effacer tout</button>
                  </div>}
                  <div className="catalogue-view-switch" aria-label="Présentation des résultats">
                    <button aria-label="Vue grille" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={19} /></button>
                    <button aria-label="Vue liste" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={20} /></button>
                  </div>
                </div>
              </div>
              {!active && <div className="catalogue-browse-hint"><p>Saisissez un titre, un auteur ou un genre pour affiner cette sélection.</p><button onClick={browseAll}>Explorer tout le catalogue <ArrowRight size={14} /></button></div>}
              {catalog.isPending ? <div className="catalogue-grid catalogue-skeleton" aria-label="Chargement des œuvres">{Array.from({ length: 6 }, (_, i) => <div key={i} />)}</div>
                : catalog.isError ? <div role="alert" className="catalogue-empty"><p>La recherche est indisponible pour le moment.</p><button className={control} onClick={() => void catalog.refetch()}>Réessayer</button></div>
                : results.length === 0 ? <div className="catalogue-empty"><h3>Aucune œuvre ne correspond à ces critères.</h3><p>Essayez un autre titre ou retirez un filtre.</p><div>
                  <button onClick={() => { setDraft(''); change({ q: '', type: '', status: '', genre: '', browse: true }); }}>Réinitialiser la recherche</button>
                  <Link to="/random">Surprise-moi <ArrowRight size={16} /></Link></div></div>
                : <div className={`catalogue-grid ${view === 'list' ? 'catalogue-list' : ''}`}>
                  {results.slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE).map((work, index) =>
                    <EditorialMangaCard key={work.id} work={work} gated={isAdultContentRating(work.content_rating) && !adultConfirmed} priority={index < 2} />)}
                </div>}
              {pages > 1 && <nav aria-label="Pages de résultats" className="catalogue-pagination">
                <button disabled={page <= 1} onClick={() => change({ page: page - 1 })}>Précédent</button><span>Page {page} / {pages}</span>
                <button disabled={page >= pages} onClick={() => change({ page: page + 1 })}>Suivant</button>
              </nav>}
            </section>
          </div>
        </div>
      </div>
    </main>
    <Footer />
  </div>;
};
export default Search;

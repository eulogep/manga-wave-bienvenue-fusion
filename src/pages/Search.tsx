import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCover from '@/components/MangaCover';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { normalizeQuery, parseSearchState, searchCanonicalWorks, serializeSearchState, SEARCH_PAGE_SIZE, type SearchState } from '@/domain/canonicalSearch';

const control = 'min-h-11 w-full min-w-0 rounded-md border border-slate-500 bg-[#101e2c] px-3 py-2 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300';
const statusLabels: Record<string, string> = { ongoing: 'En cours', completed: 'Terminé', hiatus: 'En pause', cancelled: 'Annulé' };
const Search = () => {
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
  const active = Boolean(normalizeQuery(state.q) || state.type || state.status || state.genre);
  const catalog = useCanonicalSearch(active);
  const results = useMemo(() => active ? searchCanonicalWorks(catalog.data || [], state) : [], [catalog.data, state, active]);
  const genres = useMemo(() => [...new Set((catalog.data || []).flatMap(work => work.genre || []))].sort((a, b) => a.localeCompare(b, 'fr')), [catalog.data]);
  const pages = Math.max(1, Math.ceil(results.length / SEARCH_PAGE_SIZE));
  const page = Math.min(state.page, pages);
  const change = (patch: Partial<SearchState>) => setParams(serializeSearchState({ ...state, q: draft.trim(), page: 1, ...patch }));
  const submit = (event: FormEvent) => { event.preventDefault(); change({ q: draft.trim() }); };
  const hasFilters = Boolean(state.type || state.status || state.genre);
  return <div className="min-h-screen bg-[#080c14] text-white flex flex-col">
    <Header />
    <main className="flex-1 section-padding py-10" data-testid="search-v2">
      <div className="container mx-auto min-w-0">
        <h1 className="font-editorial text-3xl md:text-4xl">Trouvez votre prochaine lecture</h1>
        <p className="mt-3 text-slate-300">Un titre, un autre nom, un auteur ou un genre : explorez le catalogue Manga Wave.</p>
        <form onSubmit={submit} className="my-8 space-y-5 rounded-xl border border-slate-600 bg-[#0f1520] p-4 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 min-w-0 space-y-2" htmlFor="manga-search"><span>Rechercher un manga</span>
              <input id="manga-search" type="search" maxLength={160} className={control} placeholder="Titre, alias, auteur, genre…" value={draft} onChange={event => setDraft(event.target.value)} />
            </label>
            <button type="submit" className="min-h-11 rounded-md bg-sky-300 px-5 font-semibold text-slate-950">Rechercher</button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="min-w-0 space-y-2"><span>Type</span><select className={control} value={state.type} onChange={event => change({ type: event.target.value as SearchState['type'] })}>
              <option value="">Tous les types</option><option value="manga">Manga</option><option value="manhwa">Manhwa</option><option value="manhua">Manhua</option>
            </select></label>
            <label className="min-w-0 space-y-2"><span>Statut</span><select className={control} value={state.status} onChange={event => change({ status: event.target.value as SearchState['status'] })}>
              <option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label className="min-w-0 space-y-2"><span>Genre</span><select className={control} value={state.genre} onChange={event => change({ genre: event.target.value })}>
              <option value="">Tous les genres</option>{[...new Set(['Action', 'Fantasy', 'Romance', ...genres, ...(state.genre ? [state.genre] : [])])].sort().map(genre => <option key={genre} value={genre}>{genre}</option>)}
            </select></label>
            <label className="min-w-0 space-y-2"><span>Trier par</span><select className={control} value={state.sort} onChange={event => change({ sort: event.target.value as SearchState['sort'] })}>
              <option value="relevance">Pertinence</option><option value="popularity">Popularité</option><option value="rating">Note</option><option value="recent">Ajouts récents</option><option value="az">A–Z</option>
            </select></label>
          </div>
          {hasFilters && <div className="flex flex-wrap items-center gap-3 text-sm">
            <p>Filtres actifs : {[state.type, statusLabels[state.status], state.genre].filter(Boolean).join(' · ')}</p>
            <button type="button" onClick={() => change({ type: '', status: '', genre: '' })} className="min-h-11 rounded-md border border-slate-500 px-4">Effacer les filtres</button>
          </div>}
        </form>
        <section aria-labelledby="canonical-results-title" aria-busy={active && catalog.isFetching}>
          <h2 id="canonical-results-title" className="font-editorial text-2xl">Résultats Manga Wave</h2>
          {!active ? <p className="py-10 text-slate-300">Saisissez un titre, un auteur ou un genre, ou choisissez un filtre pour découvrir des œuvres.</p>
            : catalog.isPending ? <p role="status" className="py-10">Chargement du catalogue…</p>
            : catalog.isError ? <div role="alert" className="py-10"><p>La recherche est indisponible pour le moment.</p><button className={`${control} mt-4 sm:w-auto`} onClick={() => void catalog.refetch()}>Réessayer</button></div>
            : <>
              <p role="status" className="my-4 text-slate-300">{results.length} résultat{results.length > 1 ? 's' : ''}{state.q && ` pour « ${state.q} »`}</p>
              {results.length === 0 ? <p className="py-8 text-slate-300">Aucune œuvre ne correspond. Essayez un autre titre ou retirez un filtre.</p> :
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {results.slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE).map(work => <article key={work.id} data-type={work.manga_type} className="min-w-0 overflow-hidden rounded-md border border-slate-600 bg-[#101e2c]">
                    <Link to={`/manga/${work.id}`} aria-label={`Découvrir ${work.title}`} className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300">
                      <MangaCover src={work.cover_image} alt="" className="aspect-[3/4] w-full object-cover" />
                      <div className="space-y-2 p-3"><h3 className="break-words font-semibold">{work.title}</h3>
                        <p className="text-sm text-slate-300 break-words">{work.author || 'Auteur non renseigné'}</p>
                        <p className="text-sm text-sky-200">{[work.manga_type, statusLabels[work.status]].filter(Boolean).join(' · ')}</p>
                        <p className="text-xs text-slate-300 break-words">{work.genre?.slice(0, 3).join(' · ')}</p>
                        {work.rating != null && <p className="text-sm text-slate-200">Note : {work.rating}/10</p>}
                        {work.aliases?.length > 0 && <p className="text-xs text-slate-300 break-words">Autres titres : {work.aliases.slice(0, 2).join(' · ')}</p>}
                      </div>
                    </Link>
                  </article>)}
                </div>}
              {pages > 1 && <nav aria-label="Pages de résultats" className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <button className="min-h-11 rounded-md border border-slate-500 px-4 disabled:opacity-50" disabled={page <= 1} onClick={() => change({ page: page - 1 })}>Précédent</button><span>Page {page} / {pages}</span>
                <button className="min-h-11 rounded-md border border-slate-500 px-4 disabled:opacity-50" disabled={page >= pages} onClick={() => change({ page: page + 1 })}>Suivant</button>
              </nav>}
            </>}
        </section>
      </div>
    </main>
    <Footer />
  </div>;
};
export default Search;

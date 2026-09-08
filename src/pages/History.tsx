import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Play, Trash2 } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MangaCover from '@/components/MangaCover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useReadingTimeline } from '@/hooks/useReadingTimeline';
import type { HistoryPeriod } from '@/domain/readingHistory';

const periods: { value: HistoryPeriod; label: string }[] = [
  { value: 'all', label: 'Tous' }, { value: 'today', label: "Aujourd’hui" },
  { value: '7', label: '7 derniers jours' }, { value: '30', label: '30 derniers jours' },
];

export default function History() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const [confirmClear, setConfirmClear] = useState(false);
  const clearButton = useRef<HTMLButtonElement>(null);
  const [actionError, setActionError] = useState('');
  const timeline = useReadingTimeline(debouncedSearch, period);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const remove = async (id: number | null) => {
    setActionError('');
    try { await timeline.remove.mutateAsync(id); setConfirmClear(false); }
    catch { setActionError('Impossible de supprimer l’historique. Réessayez.'); }
  };
  return <div className="min-h-screen flex flex-col bg-[#080c14] text-white">
    <Header />
    <main className="flex-1 w-full min-w-0 px-4 py-10 sm:px-8" data-testid="history-page">
      <div className="mx-auto max-w-3xl min-w-0">
        <Link to="/library" className="inline-flex min-h-11 items-center text-cyan-300">Ma bibliothèque</Link>
        <h1 className="text-3xl font-bold flex items-center gap-3"><Clock aria-hidden="true" /> Historique de lecture</h1>
        <p className="mt-3 text-slate-300">Retrouvez vos lectures et rouvrez le chapitre à la page enregistrée.</p>
        {loading ? <p role="status" className="py-10">Chargement…</p> : !user ? <section className="py-10">
          <p className="mb-4">Connectez-vous pour retrouver votre historique privé.</p>
          <Button asChild className="min-h-11"><Link to="/auth">Se connecter</Link></Button>
        </section> : <>
          <div className="my-6 space-y-3">
            <Input aria-label="Rechercher dans l’historique" placeholder="Rechercher un titre" className="h-11" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Période de lecture">
              {periods.map((p) => <button key={p.value} aria-pressed={period === p.value} onClick={() => setPeriod(p.value)} className={`min-h-11 rounded-lg border px-3 text-sm ${period === p.value ? 'bg-cyan-300 text-slate-950 border-cyan-300' : 'border-slate-600 text-slate-200'}`}>{p.label}</button>)}
            </div>
            <Button ref={clearButton} variant="outline" className="min-h-11" onClick={() => setConfirmClear(true)} disabled={timeline.remove.isPending}>Effacer l’historique</Button>
          </div>
          {actionError && <p role="alert" className="my-4 text-red-300">{actionError}</p>}
          {timeline.isLoading ? <p role="status">Chargement des lectures…</p> : timeline.isError ? <div role="alert">
            <p>Historique indisponible.</p><Button className="min-h-11 mt-3" onClick={() => void timeline.refetch()}>Réessayer</Button>
          </div> : timeline.entries.length === 0 ? <section className="rounded-xl border border-slate-700 p-6">
            <p>{search || period !== 'all' ? 'Aucune lecture ne correspond à ces filtres.' : 'Aucune lecture dans ton historique pour le moment.'}</p>
            <Link to="/search" className="inline-flex min-h-11 items-center text-cyan-300">Découvrir des mangas</Link>
          </section> : <>
            <ol className="space-y-4" aria-label="Lectures récentes">
              {timeline.entries.map((entry) => <li key={entry.id}>
                <article data-testid="history-entry" data-canonical-id={entry.canonical_manga_id} className="flex min-w-0 gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3 sm:p-5">
                  <MangaCover src={entry.cover_image} alt={`Couverture de ${entry.manga_title}`} className="h-28 w-16 shrink-0 rounded object-cover sm:w-20" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold break-words">{entry.manga_title}</h2>
                    <p className="text-cyan-300">Chapitre {entry.chapter_number}</p>
                    <p className="text-sm text-slate-200">Page {entry.page_index + 1} / {entry.total_pages}</p>
                    <time dateTime={entry.read_at} className="block text-sm text-slate-300">Lu le {new Date(entry.read_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button className="min-h-11 bg-cyan-300 text-slate-950 hover:bg-cyan-200" aria-label={`Rouvrir ${entry.manga_title} au chapitre ${entry.chapter_number}, page ${entry.page_index + 1}`} disabled={timeline.reopen.isPending} onClick={async () => {
                        setActionError('');
                        try { navigate(await timeline.reopen.mutateAsync(entry)); }
                        catch (error) { setActionError(error instanceof Error ? error.message : 'Chapitre indisponible.'); }
                      }}><Play className="mr-2 h-4 w-4" aria-hidden="true" /> Rouvrir</Button>
                      <Button variant="outline" className="h-11 w-11 p-0" disabled={timeline.remove.isPending} onClick={() => void remove(entry.id)} aria-label={`Supprimer la lecture de ${entry.manga_title}, chapitre ${entry.chapter_number}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                    </div>
                  </div>
                </article>
              </li>)}
            </ol>
            {timeline.hasNextPage && <Button variant="outline" className="mt-6 min-h-11" disabled={timeline.isFetchingNextPage} onClick={() => void timeline.fetchNextPage()}>Charger les lectures précédentes</Button>}
          </>}
          <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
            <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg" onCloseAutoFocus={(event) => { event.preventDefault(); clearButton.current?.focus(); }}>
              <AlertDialogHeader><AlertDialogTitle>Effacer tout l’historique ?</AlertDialogTitle><AlertDialogDescription>Seules vos lectures passées seront supprimées. Votre progression de reprise, vos favoris, vos suivis et vos notifications seront conservés.</AlertDialogDescription></AlertDialogHeader>
              {actionError && <p role="alert">{actionError}</p>}
              <AlertDialogFooter><AlertDialogCancel className="min-h-11" disabled={timeline.remove.isPending}>Annuler</AlertDialogCancel><AlertDialogAction className="min-h-11" disabled={timeline.remove.isPending} onClick={(e) => { e.preventDefault(); void remove(null); }}>Confirmer la suppression</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>}
      </div>
    </main>
    <Footer />
  </div>;
}

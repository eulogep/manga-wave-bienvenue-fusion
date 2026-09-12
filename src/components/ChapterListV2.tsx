import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, ChevronLeft, ChevronRight, ExternalLink, FileText, LoaderCircle, Play, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { filterChapters, sortChapters, type ChapterSort } from '@/domain/chapterList';
import type { SourceChapter } from '@/integrations/sources';

const INITIAL_VISIBLE = 40;

type ChapterListV2Props = {
  chapters: SourceChapter[];
  isLoading: boolean;
  errorMessage?: string | null;
  emptyMessage: string;
  onRetry: () => void;
  onRead: (chapter: SourceChapter) => void;
  total?: number;
  offset?: number;
  remotePageSize?: number;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
};

const chapterDate = (value: string) => {
  const timestamp = Date.parse(value);
  return timestamp ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp) : value;
};

const ChapterListV2 = ({ chapters, isLoading, errorMessage, emptyMessage, onRetry, onRead, total, offset = 0, remotePageSize = 100, onPreviousPage, onNextPage }: ChapterListV2Props) => {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ChapterSort>('desc');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const filtered = useMemo(() => sortChapters(filterChapters(chapters, query), sort), [chapters, query, sort]);
  const visible = filtered.slice(0, visibleCount);

  useEffect(() => setVisibleCount(INITIAL_VISIBLE), [chapters, query, sort]);

  if (isLoading) return <div className="border border-white/10 bg-white/5 py-14 text-center" aria-busy="true" role="status"><LoaderCircle className="mx-auto mb-4 h-8 w-8 animate-spin text-manga-purple" /><p className="text-muted-foreground">Chargement des chapitres…</p></div>;
  if (errorMessage) return <div className="border border-destructive/40 bg-destructive/10 p-8 text-center" role="alert"><h3 className="mb-2 text-xl font-bold">Liste des chapitres indisponible</h3><p className="mb-5 text-muted-foreground">{errorMessage}</p><Button className="btn-gradient" onClick={onRetry}>Réessayer</Button></div>;
  if (!chapters.length) return <div className="border border-dashed border-white/20 bg-white/5 px-6 py-14 text-center"><BookOpen className="mx-auto mb-4 h-10 w-10 text-manga-purple" /><h3 className="mb-2 text-xl font-bold">Aucun chapitre disponible</h3><p className="text-muted-foreground">{emptyMessage}</p></div>;

  return (
    <div data-testid="chapter-list-v2">
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <span className="sr-only">Rechercher un chapitre</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/40" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Numéro, titre ou équipe…" className="min-h-11 border-white/15 bg-black/20 pl-10" />
        </label>
        <Button type="button" variant="outline" className="min-h-11 border-white/15" onClick={() => setSort((current) => current === 'desc' ? 'asc' : 'desc')} aria-label={sort === 'desc' ? 'Trier du plus ancien au plus récent' : 'Trier du plus récent au plus ancien'}>
          {sort === 'desc' ? <ArrowDown className="mr-2 h-4 w-4" /> : <ArrowUp className="mr-2 h-4 w-4" />}
          {sort === 'desc' ? 'Plus récents' : 'Plus anciens'}
        </Button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {query ? `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}` : `${total ?? chapters.length} chapitre${(total ?? chapters.length) > 1 ? 's' : ''}`}
      </p>

      {visible.length ? <div className="divide-y divide-[var(--mw-border)] overflow-hidden border border-[var(--mw-border)] bg-[var(--mw-surface)]">
        {visible.map((chapter) => {
          const groups = chapter.scanlationGroups?.length ? chapter.scanlationGroups : chapter.scanlationGroup ? [chapter.scanlationGroup] : [];
          return <article key={chapter.id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-white/5 sm:flex-row sm:items-center md:p-5" data-testid={`chapter-${chapter.id}`}>
            <FileText className="h-5 w-5 shrink-0 text-manga-purple" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{chapter.volume ? `Tome ${chapter.volume} · ` : ''}Chapitre {chapter.chapterNumber || 'spécial'}{chapter.title ? ` — ${chapter.title}` : ''}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {chapter.date && <span>{chapterDate(chapter.date)}</span>}
                {chapter.pageCount != null && <span>{chapter.pageCount} page{chapter.pageCount > 1 ? 's' : ''}</span>}
                {groups.length > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{groups.join(', ')}</span>}
                {chapter.language && <Badge variant="outline" className="border-white/20 text-[10px]">{chapter.language.toUpperCase()}</Badge>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button className="min-h-11 border-white/30" variant="outline" onClick={() => onRead(chapter)} aria-label={`Lire le chapitre ${chapter.chapterNumber || 'spécial'}`}><Play className="mr-2 h-4 w-4" />Lire</Button>
              {chapter.externalUrl && <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-white" asChild><a href={chapter.externalUrl} target="_blank" rel="noreferrer" aria-label={`Ouvrir le chapitre ${chapter.chapterNumber || 'spécial'} sur la source`}><ExternalLink className="h-4 w-4" /></a></Button>}
            </div>
          </article>;
        })}
      </div> : <div className="border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center"><h3 className="text-lg font-bold">Aucun chapitre correspondant</h3><p className="mt-2 text-sm text-muted-foreground">Essayez un autre numéro, titre ou nom d’équipe.</p></div>}

      {visibleCount < filtered.length && <Button type="button" variant="outline" className="mt-5 min-h-11 w-full border-white/15" onClick={() => setVisibleCount((count) => count + INITIAL_VISIBLE)}>Afficher {Math.min(INITIAL_VISIBLE, filtered.length - visibleCount)} chapitres de plus</Button>}

      {total != null && total > remotePageSize && !query && <nav className="mt-7 flex items-center justify-center gap-3" aria-label="Pagination des chapitres">
        <Button variant="outline" className="min-h-11 border-white/30" disabled={offset === 0} onClick={onPreviousPage}><ChevronLeft className="mr-1 h-4 w-4" />Précédents</Button>
        <span className="text-xs text-white/45">{offset + 1}–{Math.min(offset + chapters.length, total)} / {total}</span>
        <Button variant="outline" className="min-h-11 border-white/30" disabled={offset + remotePageSize >= total} onClick={onNextPage}>Suivants<ChevronRight className="ml-1 h-4 w-4" /></Button>
      </nav>}
    </div>
  );
};

export default ChapterListV2;

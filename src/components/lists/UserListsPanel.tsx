import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ListChecks, NotebookPen, Pencil, Plus, Trash2, X } from 'lucide-react';
import MangaCover from '@/components/MangaCover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useUserLists, type UserListItemWithManga } from '@/hooks/useUserLists';
import {
  countItemsByList,
  isSystemList,
  MAX_CUSTOM_LISTS,
  MAX_LIST_NOTE_LENGTH,
  moveListItem,
  sortListItems,
  type UserList,
} from '@/domain/userLists';
import { ListNameDialog } from './ListNameDialog';

type UserListsPanelProps = {
  selectedListId: number | null;
  onSelectList: (listId: number) => void;
};

const ListItemRow = ({ item, index, total, onMove, onRemove, onSaveNote }: {
  item: UserListItemWithManga;
  index: number;
  total: number;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  onSaveNote: (note: string) => Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note || '');
  const title = item.manga?.title || 'Manga';
  const detailUrl = `/manga/${item.canonicalMangaId}`;

  useEffect(() => { if (!editing) setDraft(item.note || ''); }, [item.note, editing]);

  const save = async () => {
    try {
      await onSaveNote(draft);
      setEditing(false);
    } catch {
      // The panel already reported the error; keep the editor open with the draft.
    }
  };

  return (
    <li className="flex gap-4 rounded-2xl border border-white/[0.08] bg-[#0f1520]/80 p-3">
      <span className="hidden w-6 shrink-0 pt-1 text-center font-outfit text-sm font-bold text-white/35 sm:block" aria-hidden="true">{index + 1}</span>
      <Link to={detailUrl} className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-black/40" aria-label={`Voir la fiche de ${title}`}>
        <MangaCover src={item.manga?.cover_image || null} alt={`Couverture de ${title}`} className="h-full w-full object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={detailUrl} className="font-outfit font-bold text-white line-clamp-2 hover:text-manga-purple">{title}</Link>
            {item.manga?.author && <p className="mt-0.5 text-xs text-white/45">{item.manga.author}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-11 w-11 text-white/60" disabled={index === 0} onClick={() => onMove('up')} aria-label={`Monter ${title}`}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-11 w-11 text-white/60" disabled={index === total - 1} onClick={() => onMove('down')} aria-label={`Descendre ${title}`}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-11 w-11 text-white/60 hover:text-[var(--mw-accent-coral)]" onClick={onRemove} aria-label={`Retirer ${title} de la liste`}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {editing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              autoFocus
              value={draft}
              maxLength={MAX_LIST_NOTE_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Note privée : pourquoi le lire, où tu t’es arrêté…"
              aria-label={`Note privée pour ${title}`}
              className="min-h-20 border-white/15 bg-[#080c14] text-sm text-white"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/35">{draft.length}/{MAX_LIST_NOTE_LENGTH}</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="h-9 border-white/20" onClick={() => setEditing(false)}>Annuler</Button>
                <Button type="button" size="sm" className="btn-gradient h-9" onClick={() => void save()}>Enregistrer</Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-2 flex min-h-9 w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-white/60 hover:bg-white/[0.04] hover:text-white"
          >
            <NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-manga-cyan" aria-hidden="true" />
            {item.note ? <span className="whitespace-pre-line break-words">{item.note}</span> : <span className="italic text-white/35">Ajouter une note privée</span>}
          </button>
        )}
      </div>
    </li>
  );
};

export const UserListsPanel = ({ selectedListId, onSelectList }: UserListsPanelProps) => {
  const { toast } = useToast();
  const userLists = useUserLists();
  const { lists, items } = userLists;
  const [nameDialog, setNameDialog] = useState<{ open: boolean; list: UserList | null }>({ open: false, list: null });
  const [pendingDelete, setPendingDelete] = useState<UserList | null>(null);

  const counts = useMemo(() => countItemsByList(items), [items]);
  const selected = lists.find((list) => list.id === selectedListId) || lists[0] || null;
  const selectedItems = useMemo(
    () => (selected ? sortListItems(items.filter((item) => item.listId === selected.id)) : []),
    [items, selected],
  );
  const customCount = lists.filter((list) => !isSystemList(list)).length;

  const notifyError = (title: string) => toast({ variant: 'destructive', title, description: 'Réessaie dans un instant.' });

  const handleNameSubmit = async (name: string) => {
    if (nameDialog.list) {
      await userLists.renameList.mutateAsync({ listId: nameDialog.list.id, name });
      toast({ title: 'Liste renommée', description: name });
    } else {
      const list = await userLists.createList.mutateAsync(name);
      onSelectList(list.id);
      toast({ title: 'Liste créée', description: name });
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const list = pendingDelete;
    setPendingDelete(null);
    try {
      await userLists.deleteList.mutateAsync(list.id);
      if (lists[0]) onSelectList(lists[0].id);
      toast({ title: 'Liste supprimée', description: list.name });
    } catch {
      notifyError('Impossible de supprimer la liste');
    }
  };

  const handleMove = async (itemId: number, direction: 'up' | 'down') => {
    if (!selected) return;
    const orderedIds = moveListItem(selectedItems, itemId, direction);
    if (!orderedIds) return;
    try {
      await userLists.reorderItems.mutateAsync({ listId: selected.id, orderedIds });
    } catch {
      notifyError('Ordre non enregistré');
    }
  };

  const handleRemove = async (item: UserListItemWithManga) => {
    try {
      await userLists.setMembership.mutateAsync({ listId: item.listId, canonicalMangaId: item.canonicalMangaId, member: false });
      toast({ title: `Retiré de « ${selected?.name} »`, description: item.manga?.title });
    } catch {
      notifyError('Impossible de retirer ce manga');
    }
  };

  const handleSaveNote = async (itemId: number, note: string) => {
    try {
      await userLists.updateNote.mutateAsync({ itemId, note });
    } catch {
      notifyError('Note non enregistrée');
      throw new Error('note not saved');
    }
  };

  if (userLists.isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true">
        <div className="h-11 max-w-lg rounded-xl bg-white/10" />
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-white/5" />)}
      </div>
    );
  }

  if (userLists.isError) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
        <h2 className="mb-2 text-xl font-bold">Listes indisponibles</h2>
        <p className="mb-6 text-sm text-white/60">{userLists.error?.message}</p>
        <Button className="btn-gradient" onClick={() => void userLists.refetch()}>Réessayer</Button>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Mes listes" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            onClick={() => onSelectList(list.id)}
            aria-current={selected?.id === list.id ? 'true' : undefined}
            className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-lg px-4 py-2 text-left text-sm font-semibold transition-all ${
              selected?.id === list.id
                ? 'bg-manga-purple text-white shadow-glow-purple'
                : 'border border-white/[0.08] bg-white/[0.05] text-white/60 hover:text-white'
            }`}
          >
            <span className="truncate">{list.name}</span>
            <span className="text-xs opacity-70">{counts.get(list.id) || 0}</span>
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 justify-start border-dashed border-white/20"
          disabled={customCount >= MAX_CUSTOM_LISTS}
          onClick={() => setNameDialog({ open: true, list: null })}
        >
          <Plus className="mr-2 h-4 w-4" /> Nouvelle liste
        </Button>
      </nav>

      {selected && (
        <section aria-labelledby="selected-list-title">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="selected-list-title" className="font-outfit text-2xl font-bold">{selected.name}</h2>
              <p className="text-xs text-white/45">{selectedItems.length} titre{selectedItems.length > 1 ? 's' : ''}</p>
            </div>
            {!isSystemList(selected) && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-11 border-white/20" onClick={() => setNameDialog({ open: true, list: selected })}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Renommer
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-11 border-white/20 hover:text-[var(--mw-accent-coral)]" onClick={() => setPendingDelete(selected)}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Supprimer
                </Button>
              </div>
            )}
          </div>

          {selectedItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
              <ListChecks className="mx-auto mb-3 h-10 w-10 text-manga-cyan opacity-80" />
              <h3 className="mb-2 text-lg font-bold">Cette liste est vide</h3>
              <p className="mx-auto mb-5 max-w-md text-sm text-white/50">
                Sur la fiche d’un manga, utilise « Ajouter à une liste » pour le ranger ici.
              </p>
              <Button className="btn-gradient rounded-full px-6" asChild>
                <Link to="/search">Explorer le catalogue</Link>
              </Button>
            </div>
          ) : (
            <ol className="space-y-3">
              {selectedItems.map((item, index) => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  total={selectedItems.length}
                  onMove={(direction) => void handleMove(item.id, direction)}
                  onRemove={() => void handleRemove(item)}
                  onSaveNote={(note) => handleSaveNote(item.id, note)}
                />
              ))}
            </ol>
          )}
        </section>
      )}

      <ListNameDialog
        open={nameDialog.open}
        onOpenChange={(open) => setNameDialog((current) => ({ ...current, open }))}
        lists={lists}
        list={nameDialog.list}
        onSubmit={handleNameSubmit}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent className="border-white/15 bg-[#0f1520] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {pendingDelete?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              La liste et ses notes seront supprimées. Les mangas restent dans ta bibliothèque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 bg-transparent">Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-[var(--mw-accent-coral)] text-white hover:bg-[#ff6671]" onClick={() => void handleDelete()}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

import { BellOff, BellRing, Link2, ListMinus, ListPlus } from 'lucide-react';
import { CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';
import { useAuth } from '@/hooks/useAuth';
import { useCanonicalFollow } from '@/hooks/useFollows';
import { useToast } from '@/hooks/use-toast';
import { useUserLists } from '@/hooks/useUserLists';
import { listIdsContainingManga } from '@/domain/userLists';

const itemClass = 'flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]';

const SignedInActions = ({ mangaId, title, onDone }: { mangaId: number; title: string; onDone: () => void }) => {
  const { toast } = useToast();
  const follow = useCanonicalFollow(mangaId);
  const userLists = useUserLists();
  const toRead = userLists.lists.find((list) => list.kind === 'to_read');
  const inToRead = Boolean(toRead && listIdsContainingManga(userLists.items, mangaId).has(toRead.id));

  const run = async (action: () => Promise<unknown>, success: string) => {
    onDone();
    try {
      await action();
      toast({ title: success, description: title });
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible', description: 'Ton état précédent a été restauré.' });
    }
  };

  return (
    <>
      <CommandItem
        value="manga-follow"
        disabled={follow.isUpdating}
        onSelect={() => void run(() => follow.setFollowing(!follow.isFollowing), follow.isFollowing ? 'Suivi arrêté' : 'Manga suivi')}
        className={itemClass}
        data-testid="command-manga-follow"
      >
        {follow.isFollowing ? <BellOff className="h-4 w-4 text-white/60 shrink-0" /> : <BellRing className="h-4 w-4 text-[var(--mw-accent-coral)] shrink-0" />}
        <span className="text-sm font-medium">{follow.isFollowing ? 'Ne plus suivre' : 'Suivre les nouveaux chapitres'}</span>
      </CommandItem>
      {toRead && (
        <CommandItem
          value="manga-to-read"
          onSelect={() => void run(
            () => userLists.setMembership.mutateAsync({ listId: toRead.id, canonicalMangaId: mangaId, member: !inToRead }),
            inToRead ? `Retiré de « ${toRead.name} »` : `Ajouté à « ${toRead.name} »`,
          )}
          className={itemClass}
          data-testid="command-manga-to-read"
        >
          {inToRead ? <ListMinus className="h-4 w-4 text-white/60 shrink-0" /> : <ListPlus className="h-4 w-4 text-manga-cyan shrink-0" />}
          <span className="text-sm font-medium">{inToRead ? `Retirer de « ${toRead.name} »` : `Ajouter à « ${toRead.name} »`}</span>
        </CommandItem>
      )}
    </>
  );
};

/** Palette actions for the manga page it was opened from. */
export const CommandMangaActions = ({ mangaId, title, onDone }: { mangaId: number; title: string; onDone: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const copyLink = async () => {
    onDone();
    const url = `${window.location.origin}/manga/${mangaId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Lien copié', description: url });
    } catch {
      toast({ variant: 'destructive', title: 'Copie impossible', description: url });
    }
  };

  return (
    <>
      <CommandGroup heading={`Ce manga · ${title}`} className="text-white/40">
        {user && <SignedInActions mangaId={mangaId} title={title} onDone={onDone} />}
        <CommandItem value="manga-copy-link" onSelect={() => void copyLink()} className={itemClass} data-testid="command-manga-copy-link">
          <Link2 className="h-4 w-4 text-white/60 shrink-0" />
          <span className="text-sm font-medium">Copier le lien de la fiche</span>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator className="bg-white/[0.06] my-1" />
    </>
  );
};

import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ListPlus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUserLists } from '@/hooks/useUserLists';
import { listIdsContainingManga, MAX_CUSTOM_LISTS, type UserList } from '@/domain/userLists';
import { ListNameDialog } from './ListNameDialog';

type AddToListMenuProps = {
  canonicalMangaId: number;
  title: string;
  /** "button" renders a standalone button; "submenu" nests inside an existing dropdown. */
  variant?: 'button' | 'submenu';
  /**
   * Required with "submenu": the parent dropdown unmounts on close, so the parent
   * renders <CreateListAndAddDialog> itself and opens it from this callback.
   */
  onCreateRequest?: () => void;
};

// Radix keeps the body locked until the menu finishes closing; open dialogs right after.
const afterMenuCloses = (callback: () => void) => window.setTimeout(callback, 0);

const useListMembership = (canonicalMangaId: number, title: string) => {
  const { toast } = useToast();
  const userLists = useUserLists();
  const memberOf = useMemo(
    () => listIdsContainingManga(userLists.items, canonicalMangaId),
    [userLists.items, canonicalMangaId],
  );

  const toggle = async (list: UserList) => {
    const member = !memberOf.has(list.id);
    try {
      await userLists.setMembership.mutateAsync({ listId: list.id, canonicalMangaId, member });
      toast({ title: member ? `Ajouté à « ${list.name} »` : `Retiré de « ${list.name} »`, description: title });
    } catch {
      toast({ variant: 'destructive', title: 'Liste non modifiée', description: 'Ton état précédent a été restauré.' });
    }
  };

  const createAndAdd = async (name: string) => {
    const list = await userLists.createList.mutateAsync(name);
    await userLists.setMembership.mutateAsync({ listId: list.id, canonicalMangaId, member: true });
    toast({ title: `Liste « ${list.name} » créée`, description: `${title} y a été ajouté.` });
  };

  const canCreate = userLists.lists.filter((list) => list.kind === 'custom').length < MAX_CUSTOM_LISTS;
  return { ...userLists, memberOf, toggle, createAndAdd, canCreate };
};

const ListItems = ({ lists, memberOf, toggle, canCreate, onCreate, isLoading }: {
  lists: UserList[];
  memberOf: Set<number>;
  toggle: (list: UserList) => Promise<void>;
  canCreate: boolean;
  onCreate: () => void;
  isLoading: boolean;
}) => (
  <>
    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-white/50">Mes listes</DropdownMenuLabel>
    {isLoading && <DropdownMenuItem disabled>Chargement…</DropdownMenuItem>}
    {lists.map((list) => (
      <DropdownMenuCheckboxItem
        key={list.id}
        checked={memberOf.has(list.id)}
        onSelect={(event) => { event.preventDefault(); void toggle(list); }}
      >
        {list.name}
      </DropdownMenuCheckboxItem>
    ))}
    <DropdownMenuSeparator className="bg-white/10" />
    <DropdownMenuItem disabled={!canCreate} onSelect={onCreate}>
      <Plus className="mr-2 h-3.5 w-3.5" /> Nouvelle liste…
    </DropdownMenuItem>
  </>
);

export const CreateListAndAddDialog = ({ canonicalMangaId, title, open, onOpenChange }: {
  canonicalMangaId: number;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const membership = useListMembership(canonicalMangaId, title);
  return <ListNameDialog open={open} onOpenChange={onOpenChange} lists={membership.lists} onSubmit={membership.createAndAdd} />;
};

const SignedInAddToListMenu = ({ canonicalMangaId, title, variant = 'button', onCreateRequest }: AddToListMenuProps) => {
  const membership = useListMembership(canonicalMangaId, title);
  const [createOpen, setCreateOpen] = useState(false);
  const inLists = membership.memberOf.size;

  const items = (
    <ListItems
      lists={membership.lists}
      memberOf={membership.memberOf}
      toggle={membership.toggle}
      canCreate={membership.canCreate}
      onCreate={() => afterMenuCloses(() => (onCreateRequest ? onCreateRequest() : setCreateOpen(true)))}
      isLoading={membership.isLoading}
    />
  );

  if (variant === 'submenu') {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <ListPlus className="mr-2 h-3.5 w-3.5" /> Listes{inLists > 0 ? ` (${inLists})` : ''}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-52 border-white/15 bg-[#0f1520] text-white">{items}</DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={inLists > 0 ? 'secondary' : 'outline'}
            className={inLists > 0 ? 'border border-manga-cyan/60 bg-manga-cyan/10 text-white hover:bg-manga-cyan/20' : 'border-white/20'}
            aria-label={`Gérer les listes de ${title}`}
          >
            <ListPlus className="mr-2 h-4 w-4" aria-hidden="true" />
            {inLists > 0 ? `Dans ${inLists} liste${inLists > 1 ? 's' : ''}` : 'Ajouter à une liste'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56 border-white/15 bg-[#0f1520] text-white">{items}</DropdownMenuContent>
      </DropdownMenu>
      <ListNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        lists={membership.lists}
        onSubmit={membership.createAndAdd}
      />
    </>
  );
};

export const AddToListMenu = (props: AddToListMenuProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (user) return <SignedInAddToListMenu {...props} />;
  if (props.variant === 'submenu') return null;

  return (
    <Button
      type="button"
      variant="outline"
      className="border-white/20"
      onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`)}
    >
      <ListPlus className="mr-2 h-4 w-4" aria-hidden="true" /> Ajouter à une liste
    </Button>
  );
};

import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MAX_LIST_NAME_LENGTH, validateListName, type UserList } from '@/domain/userLists';

type ListNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: UserList[];
  /** When set, the dialog renames this list instead of creating a new one. */
  list?: UserList | null;
  onSubmit: (name: string) => Promise<void>;
};

export const ListNameDialog = ({ open, onOpenChange, lists, list, onSubmit }: ListNameDialogProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setName(list?.name || '');
      setError(null);
    }
  }, [open, list]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateListName(name, lists, list?.id);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setPending(true);
    try {
      await onSubmit(validation.name);
      onOpenChange(false);
    } catch {
      setError('Impossible d’enregistrer la liste. Réessaie dans un instant.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/15 bg-[#0f1520] text-white sm:max-w-md">
        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <DialogHeader>
            <DialogTitle>{list ? 'Renommer la liste' : 'Nouvelle liste'}</DialogTitle>
            <DialogDescription className="text-white/55">
              {list ? 'Choisis un nouveau nom pour cette liste.' : 'Par exemple « Fantasy à rattraper » ou « À offrir ».'}
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-2">
            <Label htmlFor="list-name">Nom de la liste</Label>
            <Input
              id="list-name"
              autoFocus
              value={name}
              maxLength={MAX_LIST_NAME_LENGTH}
              onChange={(event) => { setName(event.target.value); setError(null); }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'list-name-error' : undefined}
              className="h-11 border-white/15 bg-[#080c14] text-white"
            />
            {error && <p id="list-name-error" role="alert" className="text-sm text-[var(--mw-accent-coral)]">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" className="btn-gradient" disabled={pending}>{list ? 'Renommer' : 'Créer la liste'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

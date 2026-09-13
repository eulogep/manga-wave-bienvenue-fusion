import { useState } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router-dom';
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
import { isAdultContentRating, useAdultConfirmation } from '@/hooks/useAdultConfirmation';

type Props = LinkProps & { contentRating?: string | null };

/**
 * Drop-in replacement for react-router's Link that age-gates navigation to
 * works classified as explicit ('erotica'): the destination is never opened
 * before the visitor confirms being 18+, at least once on this browser.
 * Behaves exactly like Link when the work isn't gated or once confirmed.
 */
const AdultGatedLink = ({ contentRating, to, ...rest }: Props) => {
  const { confirmed, confirm } = useAdultConfirmation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const gated = isAdultContentRating(contentRating) && !confirmed;

  if (!gated) return <Link to={to} {...rest} />;

  return (
    <>
      <Link to={to} {...rest} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }} />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Contenu réservé aux adultes</AlertDialogTitle>
            <AlertDialogDescription>
              Cette œuvre est classée contenu explicite (érotique). Confirmez que vous avez 18 ans ou plus pour l’afficher.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirm();
                navigate(typeof to === 'string' ? to : `${to.pathname || ''}${to.search || ''}`);
              }}
            >
              J’ai 18 ans ou plus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdultGatedLink;

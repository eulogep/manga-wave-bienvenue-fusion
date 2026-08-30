import { BookOpen, Heart, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import MangaCover from '@/components/MangaCover';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useFavorites } from '@/hooks/useManga';
import { useToast } from '@/hooks/use-toast';

interface MangaCardProps {
  id: string | number;
  title: string;
  author: string;
  rating?: number | null;
  views?: string | null;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  genre: string[];
  imageUrl: string | null;
  lastUpdate: string;
  isFavorite?: boolean;
  favoriteId?: number;
  externalUrl?: string;
  detailUrl?: string;
  newChapterCount?: number;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ongoing: { label: 'En cours', cls: 'badge-status-ongoing' },
  completed: { label: 'Terminé', cls: 'badge-status-completed' },
  hiatus: { label: 'Pause', cls: 'badge-status-hiatus' },
  cancelled: { label: 'Annulé', cls: 'badge-status-cancelled' },
};

const MangaCard = ({
  id,
  title,
  author,
  rating,
  status,
  genre,
  imageUrl,
  isFavorite,
  favoriteId,
  externalUrl,
  detailUrl,
  newChapterCount = 0,
}: MangaCardProps) => {
  const { user } = useAuth();
  const { toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const persistedFavoriteId = favoriteId ?? (typeof id === 'number' ? id : undefined);
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.ongoing;

  const handleFavoriteClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      toast({ variant: 'destructive', title: 'Connexion requise', description: 'Connectez-vous pour ajouter des favoris.' });
      return;
    }
    if (persistedFavoriteId === undefined) {
      toast({ title: 'Favoris', description: 'Ce titre ne peut pas encore être ajouté aux favoris.' });
      return;
    }
    try {
      await toggleFavorite.mutateAsync(persistedFavoriteId);
      toast({ title: isFavorite ? 'Retiré des favoris' : 'Ajouté aux favoris', description: title });
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de modifier les favoris.' });
    }
  };

  const handleReadClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (externalUrl) window.open(externalUrl, '_blank', 'noopener,noreferrer');
  };

  const cardContent = (
    <article className="manga-card group h-full">
      <div className="relative aspect-[3/4] overflow-hidden bg-wave-card">
        <MangaCover src={imageUrl} alt={`Couverture de ${title}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06101a]/85 via-transparent to-black/10" />
        <span className={`absolute left-2 top-2 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${statusConfig.cls}`}>{statusConfig.label}</span>
        {newChapterCount > 0 && (
          <span className="absolute left-2 top-10 bg-[var(--mw-accent-coral)] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
            {newChapterCount} nouveau{newChapterCount > 1 ? 'x' : ''}
          </span>
        )}
        <button aria-label={`${isFavorite ? 'Retirer' : 'Ajouter'} ${title} ${isFavorite ? 'des' : 'aux'} favoris`} className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center border border-white/15 bg-black/65 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-[var(--mw-accent-coral)]" onClick={handleFavoriteClick}>
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-[var(--mw-accent-coral)] text-[var(--mw-accent-coral)]' : 'text-white/85'}`} />
        </button>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
          {rating != null ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/85"><Star className="h-3 w-3 fill-manga-gold text-manga-gold" />{rating.toFixed(1)}</span> : <span />}
          <div className="translate-y-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            {detailUrl ? (
              <Link to={detailUrl} className="flex h-10 w-10 items-center justify-center bg-[var(--mw-accent-coral)] text-white hover:bg-[#ff6671]" onClick={(event) => event.stopPropagation()} aria-label={`Découvrir ${title}`}><BookOpen className="h-4 w-4" /></Link>
            ) : externalUrl ? (
              <Button size="sm" className="h-10 w-10 bg-[var(--mw-accent-coral)] p-0 text-white" onClick={handleReadClick} aria-label={`Lire ${title}`}><BookOpen className="h-4 w-4" /></Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--mw-border)] px-3 py-3">
        <h3 className="line-clamp-2 min-h-10 font-editorial text-sm font-semibold uppercase leading-5 text-[var(--mw-text-primary)]">{title}</h3>
        <p className="mt-1 truncate text-[11px] text-[var(--mw-text-secondary)]">{author}</p>
        {genre.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
            {genre.slice(0, 2).map((item) => <span key={item} className="text-[9px] font-semibold uppercase tracking-wider text-[var(--mw-text-secondary)]">{item}</span>)}
          </div>
        )}
      </div>
    </article>
  );

  return detailUrl ? <Link to={detailUrl} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mw-accent-coral)]">{cardContent}</Link> : cardContent;
};

export default MangaCard;

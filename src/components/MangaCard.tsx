import { Heart, Star, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/hooks/useManga';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import MangaCover from '@/components/MangaCover';

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
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ongoing:   { label: 'En cours',  cls: 'badge-status-ongoing' },
  completed: { label: 'Terminé',   cls: 'badge-status-completed' },
  hiatus:    { label: 'Pause',     cls: 'badge-status-hiatus' },
  cancelled: { label: 'Annulé',   cls: 'badge-status-cancelled' },
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
      toast({
        variant: 'destructive',
        title: 'Connexion requise',
        description: 'Veuillez vous connecter pour ajouter des favoris.',
      });
      return;
    }

    if (persistedFavoriteId === undefined) {
      toast({
        title: 'Favoris MangaDex',
        description: 'La synchronisation sera ajoutée prochainement.',
      });
      return;
    }

    try {
      await toggleFavorite.mutateAsync(persistedFavoriteId);
      toast({
        title: isFavorite ? 'Retiré des favoris' : 'Ajouté aux favoris',
        description: `${title} ${isFavorite ? 'retiré de' : 'ajouté à'} vos favoris.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de modifier les favoris.' });
    }
  };

  const handleReadClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const cardContent = (
    <article className="manga-card group">
      {/* ── Cover Area ── */}
      <div className="relative aspect-[3/4] overflow-hidden bg-wave-card">
        {/* Cover image */}
        <MangaCover
          src={imageUrl}
          alt={`Couverture de ${title}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Permanent bottom gradient — title always visible */}
        <div className="absolute inset-0 bg-cover-overlay pointer-events-none" />

        {/* Status badge — top left */}
        <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${statusConfig.cls}`}>
          {statusConfig.label}
        </span>

        {/* Favorite button — top right */}
        <button
          aria-label={`${isFavorite ? 'Retirer' : 'Ajouter'} ${title} ${isFavorite ? 'des' : 'aux'} favoris`}
          className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-250 hover:bg-black/80 hover:scale-110"
          onClick={handleFavoriteClick}
        >
          <Heart className={`h-3.5 w-3.5 transition-colors ${isFavorite ? 'fill-manga-pink text-manga-pink' : 'text-white/80'}`} />
        </button>

        {/* Bottom section: title + CTA — always visible */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-outfit font-bold text-sm text-white line-clamp-2 leading-tight mb-2 drop-shadow-sm">
            {title}
          </h3>

          {/* Rating pill */}
          {rating != null && (
            <div className="flex items-center gap-1 mb-2">
              <Star className="h-3 w-3 text-manga-gold fill-manga-gold" />
              <span className="text-xs text-white/80 font-semibold">{rating.toFixed(1)}</span>
            </div>
          )}

          {/* CTA — appears on hover */}
          <div className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            {detailUrl ? (
              <Link
                to={detailUrl}
                className="flex items-center justify-center gap-1.5 w-full h-8 rounded-lg bg-manga-purple text-white text-xs font-semibold hover:bg-manga-purple-light transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <BookOpen className="h-3 w-3" />
                Lire
              </Link>
            ) : externalUrl ? (
              <Button
                size="sm"
                className="w-full h-8 btn-gradient text-xs font-semibold rounded-lg"
                onClick={handleReadClick}
              >
                <BookOpen className="h-3 w-3 mr-1" />
                Lire
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Info strip below cover ── */}
      <div className="px-3 py-2">
        <p className="text-[11px] text-white/40 truncate">{author}</p>
        {genre.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {genre.slice(0, 2).map((g) => (
              <span
                key={g}
                className="px-1.5 py-0.5 rounded text-[10px] bg-white/[0.06] text-white/50 border border-white/[0.04]"
              >
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );

  if (detailUrl) {
    return (
      <Link to={detailUrl} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-manga-purple rounded-xl">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
};

export default MangaCard;

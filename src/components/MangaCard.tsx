import { Heart, Star, Eye, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFavorites } from '@/hooks/useManga';
import { useAuth } from '@/hooks/useAuth';
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
}

const MangaCard = ({
  id,
  title,
  author,
  rating,
  views,
  status,
  genre,
  imageUrl,
  lastUpdate,
  isFavorite,
  favoriteId,
  externalUrl,
}: MangaCardProps) => {
  const { user } = useAuth();
  const { toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const persistedFavoriteId = favoriteId ?? (typeof id === 'number' ? id : undefined);

  const statusColors = {
    ongoing: 'bg-green-500',
    completed: 'bg-blue-500',
    hiatus: 'bg-yellow-500',
    cancelled: 'bg-red-500',
  };

  const statusLabels = {
    ongoing: 'En cours',
    completed: 'Terminé',
    hiatus: 'Pause',
    cancelled: 'Annulé',
  };

  const handleFavoriteClick = async (event: React.MouseEvent) => {
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
        title: 'Favoris MangaDex bientôt disponibles',
        description: 'La synchronisation des favoris du catalogue externe sera ajoutée avec la bibliothèque.',
      });
      return;
    }

    try {
      await toggleFavorite.mutateAsync(persistedFavoriteId);
      toast({
        title: isFavorite ? 'Retiré des favoris' : 'Ajouté aux favoris',
        description: `${title} ${isFavorite ? 'a été retiré de' : 'a été ajouté à'} vos favoris.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de modifier les favoris.',
      });
    }
  };

  const handleReadClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    toast({
      title: 'Lecteur à venir',
      description: 'La lecture intégrée sera disponible une fois la navigation des chapitres implémentée.',
    });
  };

  return (
    <article className="manga-card group cursor-pointer">
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={imageUrl || 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop'}
          alt={`Couverture de ${title}`}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-4 left-4 right-4">
            <Button size="sm" className="w-full btn-gradient" onClick={handleReadClick}>
              Voir sur MangaDex
            </Button>
          </div>
        </div>

        <Badge className={`absolute top-3 left-3 ${statusColors[status]} text-white border-0`}>
          {statusLabels[status]}
        </Badge>

        <Button
          size="icon"
          variant="ghost"
          aria-label={`Ajouter ${title} aux favoris`}
          className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          onClick={handleFavoriteClick}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
        </Button>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-lg mb-1 line-clamp-2 group-hover:text-manga-purple transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">{author}</p>

        <div className="flex flex-wrap gap-1 mb-3 min-h-5">
          {genre.slice(0, 2).map((item) => (
            <Badge key={item} variant="secondary" className="text-xs bg-white/10 text-white/80 border-0">
              {item}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-3">
            {rating !== null && rating !== undefined && (
              <div className="flex items-center">
                <Star className="h-4 w-4 text-manga-gold mr-1" />
                <span>{rating.toFixed(1)}</span>
              </div>
            )}
            {views && (
              <div className="flex items-center">
                <Eye className="h-4 w-4 mr-1" />
                <span>{views}</span>
              </div>
            )}
          </div>
          <div className="flex items-center shrink-0 ml-2">
            <Clock className="h-4 w-4 mr-1" />
            <span>{lastUpdate}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default MangaCard;

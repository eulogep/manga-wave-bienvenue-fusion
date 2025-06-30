
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MangaCard from './MangaCard';
import { useManga } from '@/hooks/useManga';

const FeaturedSection = () => {
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const { mangas, favorites, isLoading } = useManga();

  if (isLoading) {
    return (
      <section className="py-16 section-padding">
        <div className="container mx-auto">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-white/10 rounded w-64 mx-auto mb-4"></div>
              <div className="h-4 bg-white/10 rounded w-96 mx-auto"></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const displayedMangas = (mangas || []).map(manga => ({
    id: manga.id,
    title: manga.title,
    author: manga.author || 'Auteur inconnu',
    rating: manga.rating || 0,
    views: manga.views ? `${Math.floor(manga.views / 1000)}k` : '0',
    status: (manga.status as 'ongoing' | 'completed' | 'hiatus') || 'ongoing',
    genre: manga.genre || [],
    imageUrl: manga.cover_image || '',
    lastUpdate: new Date(manga.created_at).toLocaleDateString('fr-FR'),
    isFavorite: favorites.includes(manga.id)
  }));

  return (
    <section className="py-16 section-padding">
      <div className="container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
          <div>
            <h2 className="text-4xl font-bold mb-4 font-japanese">
              <span className="glow-text">Sélection</span> du moment
            </h2>
            <p className="text-xl text-muted-foreground">
              Les mangas les plus populaires et récents
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4 mt-6 md:mt-0">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtrer:</span>
            </div>
            
            <Select value={selectedGenre} onValueChange={setSelectedGenre}>
              <SelectTrigger className="w-32 bg-white/10 border-white/20">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent className="bg-manga-dark border-white/20">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="action">Action</SelectItem>
                <SelectItem value="romance">Romance</SelectItem>
                <SelectItem value="comedy">Comédie</SelectItem>
                <SelectItem value="drama">Drame</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-32 bg-white/10 border-white/20">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-manga-dark border-white/20">
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="ongoing">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="hiatus">Pause</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Navigation Arrows */}
        <div className="flex justify-end space-x-2 mb-8">
          <Button variant="outline" size="icon" className="border-white/30 hover:bg-white/10">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="border-white/30 hover:bg-white/10">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Manga Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {displayedMangas.length > 0 ? (
            displayedMangas.map((manga, index) => (
              <div key={manga.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <MangaCard {...manga} />
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground text-lg">Aucun manga trouvé</p>
            </div>
          )}
        </div>

        {/* Load More */}
        <div className="text-center mt-12">
          <Button size="lg" variant="outline" className="border-white/30 hover:bg-white/10">
            Voir plus de mangas
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedSection;

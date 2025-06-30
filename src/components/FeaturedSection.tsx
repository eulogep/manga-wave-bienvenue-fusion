
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MangaCard from './MangaCard';

const FeaturedSection = () => {
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const featuredMangas = [
    {
      title: "Attack on Titan",
      author: "Hajime Isayama",
      rating: 4.9,
      views: "2.5M",
      status: "completed" as const,
      genre: ["Action", "Drama", "Fantasy"],
      imageUrl: "photo-1578662996442-48f60103fc96",
      lastUpdate: "2j"
    },
    {
      title: "One Piece",
      author: "Eiichiro Oda", 
      rating: 4.8,
      views: "5.2M",
      status: "ongoing" as const,
      genre: ["Adventure", "Comedy", "Action"],
      imageUrl: "photo-1578662947824-f3c5e11c1a9d",
      lastUpdate: "1j"
    },
    {
      title: "Demon Slayer",
      author: "Koyoharu Gotouge",
      rating: 4.7,
      views: "3.1M", 
      status: "completed" as const,
      genre: ["Action", "Supernatural", "Historical"],
      imageUrl: "photo-1578668073920-8e3f50102b3b",
      lastUpdate: "3j"
    },
    {
      title: "My Hero Academia",
      author: "Kohei Horikoshi",
      rating: 4.6,
      views: "1.8M",
      status: "ongoing" as const,
      genre: ["Action", "School", "Superhero"],
      imageUrl: "photo-1578668164071-a6b5c3e3b8c5",
      lastUpdate: "1j"
    },
    {
      title: "Jujutsu Kaisen",
      author: "Gege Akutami",
      rating: 4.8,
      views: "2.9M",
      status: "ongoing" as const,
      genre: ["Action", "Supernatural", "School"],
      imageUrl: "photo-1578668164426-6b8b7e8f6e7d",
      lastUpdate: "2j"
    },
    {
      title: "Chainsaw Man",
      author: "Tatsuki Fujimoto",
      rating: 4.7,
      views: "2.2M",
      status: "hiatus" as const,
      genre: ["Action", "Horror", "Supernatural"],
      imageUrl: "photo-1578668164780-9e9d8e4e5e5e",
      lastUpdate: "1sem"
    }
  ];

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
          {featuredMangas.map((manga, index) => (
            <div key={index} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <MangaCard {...manga} />
            </div>
          ))}
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

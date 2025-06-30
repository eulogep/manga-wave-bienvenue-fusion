
import { useState } from 'react';
import { Search, Menu, User, Heart, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-manga-dark/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto section-padding">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <BookOpen className="h-8 w-8 text-manga-purple" />
            <h1 className="text-2xl font-bold font-japanese glow-text">
              Bienvenue
            </h1>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-foreground hover:text-manga-purple transition-colors font-medium">
              Accueil
            </a>
            <a href="#" className="text-foreground hover:text-manga-purple transition-colors font-medium">
              Mangas
            </a>
            <a href="#" className="text-foreground hover:text-manga-purple transition-colors font-medium">
              Webtoons
            </a>
            <a href="#" className="text-foreground hover:text-manga-purple transition-colors font-medium">
              Nouveautés
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              {isSearchOpen ? (
                <Input
                  type="text"
                  placeholder="Rechercher un manga..."
                  className="w-64 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  autoFocus
                  onBlur={() => setIsSearchOpen(false)}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSearchOpen(true)}
                  className="hover:bg-white/10"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}
            </div>

            {/* Favorites */}
            <Button variant="ghost" size="icon" className="hover:bg-white/10">
              <Heart className="h-5 w-5" />
            </Button>

            {/* Profile */}
            <Button variant="ghost" size="icon" className="hover:bg-white/10">
              <User className="h-5 w-5" />
            </Button>

            {/* Mobile Menu */}
            <Button variant="ghost" size="icon" className="md:hidden hover:bg-white/10">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

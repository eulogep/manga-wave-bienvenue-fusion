
import { useState } from 'react';
import { Search, Menu, User, Heart, BookOpen, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-manga-dark/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto section-padding">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')}>
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
            {user && (
              <Button variant="ghost" size="icon" className="hover:bg-white/10">
                <Heart className="h-5 w-5" />
              </Button>
            )}

            {/* Profile */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-manga-dark border-white/20">
                  <DropdownMenuItem onClick={handleSignOut} className="text-white hover:bg-white/10">
                    <LogOut className="h-4 w-4 mr-2" />
                    Se déconnecter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                variant="ghost" 
                size="icon" 
                className="hover:bg-white/10"
                onClick={() => navigate('/auth')}
              >
                <User className="h-5 w-5" />
              </Button>
            )}

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

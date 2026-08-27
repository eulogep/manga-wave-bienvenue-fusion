import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, User, Heart, BookOpen, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) return;

    navigate(`/search?q=${encodeURIComponent(query)}`);
    setIsSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-manga-dark/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto section-padding">
        <div className="flex items-center justify-between h-16 gap-4">
          <button className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/')} aria-label="Retour à l’accueil">
            <BookOpen className="h-8 w-8 text-manga-purple" />
            <span className="text-2xl font-bold font-japanese glow-text">Bienvenue</span>
          </button>

          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-foreground hover:text-manga-purple transition-colors font-medium">
              Accueil
            </Link>
            <Link to="/search" className="text-foreground hover:text-manga-purple transition-colors font-medium">
              Mangas
            </Link>
            <a href="#mangas" className="text-foreground hover:text-manga-purple transition-colors font-medium">
              Webtoons
            </a>
            <a href="#mangas" className="text-foreground hover:text-manga-purple transition-colors font-medium">
              Nouveautés
            </a>
          </nav>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="relative">
              {isSearchOpen ? (
                <form onSubmit={submitSearch}>
                  <Input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Rechercher un manga..."
                    minLength={2}
                    className="w-48 sm:w-64 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    autoFocus
                    onBlur={() => {
                      if (!searchQuery.trim()) setIsSearchOpen(false);
                    }}
                    aria-label="Rechercher un manga"
                  />
                </form>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)} className="hover:bg-white/10" aria-label="Ouvrir la recherche">
                  <Search className="h-5 w-5" />
                </Button>
              )}
            </div>

            {user && (
              <Button variant="ghost" size="icon" className="hover:bg-white/10" aria-label="Mes favoris">
                <Heart className="h-5 w-5" />
              </Button>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-white/10" aria-label="Mon compte">
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
              <Button variant="ghost" size="icon" className="hover:bg-white/10" onClick={() => navigate('/auth')} aria-label="Se connecter">
                <User className="h-5 w-5" />
              </Button>
            )}

            <Button variant="ghost" size="icon" className="md:hidden hover:bg-white/10" aria-label="Ouvrir le menu mobile">
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

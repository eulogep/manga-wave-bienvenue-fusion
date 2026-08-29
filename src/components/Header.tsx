import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, User, BookMarked, LogOut, X, Compass, Flame, Home, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const MangaWaveLogo = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ff4d5a" />
        <stop offset="1" stopColor="#ff818a" />
      </linearGradient>
    </defs>
    <path d="M4 22 Q 7 8, 14 14 Q 21 20, 24 6" stroke="url(#logo-grad)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <rect x="8" y="8" width="12" height="16" rx="1.5" stroke="url(#logo-grad)" strokeWidth="1.8" fill="none"/>
    <line x1="11" y1="13" x2="17" y2="13" stroke="url(#logo-grad)" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="11" y1="16" x2="15" y2="16" stroke="url(#logo-grad)" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const navLinks = [
  { label: 'Accueil', to: '/', icon: Home },
  { label: 'Mangas', to: '/search', icon: Compass },
  { label: 'Découvrir', to: '/search', icon: Flame },
];

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = searchQuery.trim();
    if (q.length < 2) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to.split('?')[0]);
  };

  return (
    <>
      {/* ── HEADER ── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'border-b border-[var(--mw-border)] bg-[#06101a]/96 backdrop-blur-xl'
            : 'border-b border-[var(--mw-border)]/70 bg-[#06101a]/88 backdrop-blur-md'
        }`}
      >
        <div className="container mx-auto section-padding">
          <div className="flex h-[72px] items-center justify-between gap-4">

            {/* ── Logo ── */}
            <button
              className="flex items-center gap-2.5 cursor-pointer group shrink-0"
              onClick={() => navigate('/')}
              aria-label="Manga Wave — Retour à l'accueil"
            >
              <span className="group-hover:scale-110 transition-transform duration-300">
                <MangaWaveLogo />
              </span>
              <span className="font-outfit text-lg font-extrabold uppercase tracking-[0.08em] text-white transition-opacity group-hover:opacity-90">
                Manga <span className="text-[var(--mw-accent-coral)]">Wave</span>
              </span>
            </button>

            {/* ── Desktop Nav ── */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Navigation principale">
              {navLinks.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`nav-link relative flex min-h-11 items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                    isActive(to)
                      ? 'text-white after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-[var(--mw-accent-coral)]'
                      : 'text-[var(--mw-text-secondary)] hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                  {label}
                </Link>
              ))}
              {user && (
                <Link
                  to="/library"
                  className={`nav-link relative flex min-h-11 items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                    isActive('/library')
                      ? 'text-white after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-[var(--mw-accent-coral)]'
                      : 'text-[var(--mw-text-secondary)] hover:text-white'
                  }`}
                >
                  <Library className="h-3.5 w-3.5 opacity-70" />
                  Bibliothèque
                </Link>
              )}
            </nav>

            {/* ── Right Actions ── */}
            <div className="flex items-center gap-1 sm:gap-2">

              {/* Search — expandable */}
              <div className="relative flex items-center">
                {isSearchOpen ? (
                  <form onSubmit={submitSearch} className="flex items-center gap-2 animate-fade-blur-in">
                    <Input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Titre, auteur, genre…"
                      minLength={2}
                      className="w-52 sm:w-72 h-9 bg-white/[0.06] border-white/[0.12] text-white placeholder:text-white/40 rounded-full pl-4 pr-4 focus:border-manga-purple/50 focus:bg-white/[0.08] transition-all duration-200"
                      autoFocus
                      onBlur={() => {
                        if (!searchQuery.trim()) setIsSearchOpen(false);
                      }}
                      aria-label="Rechercher un manga"
                    />
                    <button
                      type="button"
                      onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                      className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
                      aria-label="Fermer la recherche"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSearchOpen(true)}
                    className="h-9 w-9 rounded-full text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
                    aria-label="Ouvrir la recherche"
                  >
                    <Search className="h-4.5 w-4.5" />
                  </Button>
                )}
              </div>

              {/* User */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex h-10 w-10 items-center justify-center border border-[var(--mw-accent-coral)] bg-[var(--mw-accent-coral)]/10 text-sm font-bold text-white transition-colors hover:bg-[var(--mw-accent-coral)]/20"
                      aria-label="Mon compte"
                    >
                      {user.email?.charAt(0).toUpperCase() ?? <User className="h-4 w-4" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 bg-[#0f1520] border-white/[0.08] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)] rounded-xl p-1"
                  >
                    <div className="px-3 py-2 mb-1">
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem
                      onClick={() => navigate('/library')}
                      className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/[0.06] rounded-lg px-3 py-2 cursor-pointer transition-colors"
                    >
                      <BookMarked className="h-4 w-4" />
                      Ma bibliothèque
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-manga-pink/80 hover:text-manga-pink hover:bg-manga-pink/[0.06] rounded-lg px-3 py-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Se déconnecter
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className="h-10 border border-[var(--mw-border)] px-4 text-xs font-semibold uppercase tracking-wider text-white/75 hover:border-[var(--mw-accent-coral)] hover:bg-transparent hover:text-white"
                  aria-label="Se connecter"
                >
                  Connexion
                </Button>
              )}

              {/* Mobile Menu Trigger */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9 rounded-full text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <nav
            className="absolute bottom-0 right-0 top-0 flex w-72 animate-slide-in-right flex-col gap-6 border-l border-[var(--mw-border)] bg-[var(--mw-surface)] p-6 shadow-2xl"
            aria-label="Menu mobile"
          >
            <div className="flex items-center justify-between">
              <span className="font-outfit font-bold text-lg text-white">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {navLinks.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive(to)
                      ? 'bg-manga-purple/15 text-white border border-manga-purple/25'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {label}
                </Link>
              ))}
              {user && (
                <Link
                  to="/library"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-white/60 hover:text-white hover:bg-white/[0.05] transition-all"
                >
                  <Library className="h-4.5 w-4.5" />
                  Bibliothèque
                </Link>
              )}
            </div>

            <div className="mt-auto pt-6 border-t border-white/[0.06]">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-manga-pink/80 hover:text-manga-pink hover:bg-manga-pink/[0.06] font-medium transition-all"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  Se déconnecter
                </button>
              ) : (
                <Button
                  className="w-full btn-gradient rounded-xl font-semibold"
                  onClick={() => { setIsMobileMenuOpen(false); navigate('/auth'); }}
                >
                  Se connecter
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
};

export default Header;

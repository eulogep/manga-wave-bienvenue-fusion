import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  Compass,
  Home,
  Library,
  History,
  Flame,
  Sparkles,
  TrendingUp,
  X,
  CornerDownLeft,
  BookMarked,
  Dices,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import MangaCover from '@/components/MangaCover';
import { useCommandSearch } from '@/hooks/useCommandSearch';
import { useCanonicalSearch } from '@/hooks/useCanonicalSearch';
import { useContinueReading } from '@/hooks/useReadingProgress';
import {
  searchCanonicalWorks,
  normalizeQuery,
  type SearchWork,
} from '@/domain/canonicalSearch';
import { discoveryStatusLabel } from '@/domain/discoveryPresentation';

export const CommandSearchDialog: React.FC = () => {
  const { isOpen, setIsOpen, initialQuery, shortcutLabel } = useCommandSearch();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Hydrate query when opened with initialQuery
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery || '');
    }
  }, [isOpen, initialQuery]);

  // Lazy-load canonical catalog snapshot when dialog opens
  const catalog = useCanonicalSearch(isOpen);
  const { data: readingProgress } = useContinueReading();

  const trimmedQuery = query.trim();
  const hasQuery = Boolean(normalizeQuery(trimmedQuery));

  // Compute top canonical results when query is non-empty
  const topResults = useMemo<SearchWork[]>(() => {
    if (!hasQuery || !catalog.data) return [];
    const matched = searchCanonicalWorks(catalog.data, {
      q: trimmedQuery,
      type: '',
      status: '',
      genre: '',
      sort: 'relevance',
      page: 1,
    });
    return matched.slice(0, 8);
  }, [hasQuery, catalog.data, trimmedQuery]);

  // Last read items for resume action
  const resumeItems = useMemo(() => {
    return (readingProgress || []).slice(0, 2);
  }, [readingProgress]);

  const handleSelect = useCallback(
    (action: () => void) => {
      setIsOpen(false);
      action();
    },
    [setIsOpen]
  );

  const navigateToManga = useCallback(
    (mangaId: number) => {
      handleSelect(() => navigate(`/manga/${mangaId}`));
    },
    [handleSelect, navigate]
  );

  const navigateToSearchWithQuery = useCallback(
    (q: string) => {
      handleSelect(() => navigate(`/search?q=${encodeURIComponent(q)}`));
    },
    [handleSelect, navigate]
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="max-w-2xl overflow-hidden p-0 border border-white/[0.12] bg-[#0b131f]/95 backdrop-blur-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] rounded-2xl text-white top-[25%] translate-y-[-20%] sm:rounded-2xl"
        data-testid="command-search-dialog"
      >
        <DialogTitle className="sr-only">Recherche et commandes rapides</DialogTitle>
        <DialogDescription className="sr-only">
          Recherchez instantanément une œuvre par titre, alias, auteur ou genre, ou accédez aux raccourcis Manga Wave.
        </DialogDescription>

        <Command
          shouldFilter={false}
          className="bg-transparent text-white"
          data-testid="command-palette"
        >
          {/* Input header */}
          <div className="relative flex items-center border-b border-white/[0.08] px-4 py-3">
            <Search className="h-5 w-5 text-white/50 shrink-0 mr-3" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
              placeholder="Rechercher un manga, auteur, genre, alias..."
              className="flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
              autoFocus
              aria-label="Recherche rapide"
              data-testid="command-search-input"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors mr-1"
                aria-label="Effacer la saisie"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono tracking-tight text-white/50 bg-white/[0.06] border border-white/[0.1] rounded hover:text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
              aria-label="Fermer la recherche"
            >
              ESC
            </button>
          </div>

          <CommandList
            className="max-h-[60vh] sm:max-h-[420px] overflow-y-auto overflow-x-hidden p-2 scrollbar-thin"
            data-testid="command-search-list"
          >
            {/* When typing a query */}
            {hasQuery ? (
              <>
                {catalog.isPending ? (
                  <div className="py-8 text-center text-sm text-white/50" role="status">
                    Recherche dans le catalogue…
                  </div>
                ) : topResults.length === 0 ? (
                  <CommandEmpty className="py-10 text-center">
                    <p className="text-white/70 text-sm mb-3">
                      Aucune œuvre trouvée pour « <span className="text-white font-medium">{trimmedQuery}</span> »
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateToSearchWithQuery(trimmedQuery)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg hover:bg-sky-500/20 transition-colors"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Lancer une recherche avancée sur « {trimmedQuery} »
                    </button>
                  </CommandEmpty>
                ) : (
                  <>
                    <CommandGroup heading="Œuvres correspondantes" className="text-white/40">
                      {topResults.map((work) => {
                        const normalizedQ = normalizeQuery(trimmedQuery);
                        const matchedAlias = (work.aliases || []).find(
                          (alias) => normalizeQuery(alias).includes(normalizedQ)
                        );

                        return (
                          <CommandItem
                            key={work.id}
                            value={`manga-${work.id}-${work.title}`}
                            onSelect={() => navigateToManga(work.id)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-white data-[selected=true]:bg-white/[0.08] data-[selected=true]:border-l-2 data-[selected=true]:border-l-[var(--mw-accent-coral)]"
                            data-testid={`command-item-manga-${work.id}`}
                          >
                            <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-slate-800">
                              <MangaCover
                                src={work.cover_image}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-white truncate">
                                  {work.title}
                                </span>
                                {work.manga_type ? (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded font-medium uppercase tracking-wider ${
                                      work.manga_type === 'manhwa'
                                        ? 'bg-sky-500/20 text-sky-300'
                                        : work.manga_type === 'manhua'
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-purple-500/20 text-purple-300'
                                    }`}
                                  >
                                    {work.manga_type}
                                  </span>
                                ) : null}
                                {work.status ? (
                                  <span className="text-[10px] text-white/40 hidden sm:inline">
                                    {discoveryStatusLabel(work.status)}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-white/50 truncate mt-0.5">
                                {matchedAlias ? (
                                  <span className="text-sky-300/80 mr-1.5">
                                    Alias : {matchedAlias}
                                  </span>
                                ) : null}
                                <span>{work.author || 'Auteur non renseigné'}</span>
                                {work.genre?.length ? ` · ${work.genre.slice(0, 2).join(', ')}` : ''}
                              </p>
                            </div>
                            <CornerDownLeft className="h-3.5 w-3.5 text-white/30 shrink-0 hidden sm:block" />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>

                    <CommandSeparator className="bg-white/[0.06] my-2" />

                    <CommandGroup heading="Action globale">
                      <CommandItem
                        value={`global-search-${trimmedQuery}`}
                        onSelect={() => navigateToSearchWithQuery(trimmedQuery)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sky-300 data-[selected=true]:bg-sky-500/10"
                        data-testid="command-item-full-search"
                      >
                        <Search className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium truncate">
                          Voir tous les résultats pour « {trimmedQuery} »
                        </span>
                        <CornerDownLeft className="h-3.5 w-3.5 ml-auto opacity-50" />
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            ) : (
              /* When query is empty */
              <>
                {/* Reprendre la lecture */}
                {resumeItems.length > 0 ? (
                  <>
                    <CommandGroup heading="Continuer la lecture" className="text-white/40">
                      {resumeItems.map((item) => (
                        <CommandItem
                          key={`${item.canonicalMangaId || item.mangaId}-${item.chapterId}`}
                          value={`resume-${item.mangaTitle}`}
                          onSelect={() => {
                            if (item.canonicalMangaId) {
                              handleSelect(() => navigate(`/manga/${item.canonicalMangaId}`));
                            } else {
                              handleSelect(() =>
                                navigate(
                                  `/read/${item.source}/${item.mangaId}/${item.chapterId}?page=${item.pageIndex}`
                                )
                              );
                            }
                          }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-white data-[selected=true]:bg-white/[0.08]"
                          data-testid={`command-resume-${item.canonicalMangaId || item.mangaId}`}
                        >
                          <BookOpen className="h-4 w-4 text-[var(--mw-accent-coral)] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-white truncate block">
                              {item.mangaTitle}
                            </span>
                            <span className="text-xs text-white/50">
                              Chapitre {item.chapterNumber} · Page {item.pageIndex + 1}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--mw-accent-coral)] font-medium shrink-0">
                            Reprendre
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator className="bg-white/[0.06] my-1" />
                  </>
                ) : null}

                {/* Navigation rapide */}
                <CommandGroup heading="Navigation" className="text-white/40">
                  <CommandItem
                    value="nav-home"
                    onSelect={() => handleSelect(() => navigate('/'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                    data-testid="command-nav-home"
                  >
                    <Home className="h-4 w-4 text-white/60 shrink-0" />
                    <span className="text-sm font-medium">Accueil</span>
                  </CommandItem>

                  <CommandItem
                    value="nav-catalog"
                    onSelect={() => handleSelect(() => navigate('/search'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                    data-testid="command-nav-search"
                  >
                    <Compass className="h-4 w-4 text-white/60 shrink-0" />
                    <span className="text-sm font-medium">Explorer le catalogue complet</span>
                  </CommandItem>

                  <CommandItem
                    value="nav-library"
                    onSelect={() => handleSelect(() => navigate('/library'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                    data-testid="command-nav-library"
                  >
                    <Library className="h-4 w-4 text-white/60 shrink-0" />
                    <span className="text-sm font-medium">Ma bibliothèque</span>
                  </CommandItem>

                  <CommandItem
                    value="nav-random"
                    onSelect={() => handleSelect(() => navigate('/random'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                    data-testid="command-nav-random"
                  >
                    <Dices className="h-4 w-4 text-manga-cyan shrink-0" />
                    <span className="text-sm font-medium">Surprends-moi</span>
                  </CommandItem>

                  <CommandItem
                    value="nav-history"
                    onSelect={() => handleSelect(() => navigate('/history'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                    data-testid="command-nav-history"
                  >
                    <History className="h-4 w-4 text-white/60 shrink-0" />
                    <span className="text-sm font-medium">Historique de lecture</span>
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator className="bg-white/[0.06] my-1" />

                {/* Formats & Types */}
                <CommandGroup heading="Explorer par format" className="text-white/40">
                  <CommandItem
                    value="type-manhwa"
                    onSelect={() => handleSelect(() => navigate('/search?type=manhwa'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                    data-testid="command-filter-manhwa"
                  >
                    <span className="text-base shrink-0">🇰🇷</span>
                    <span className="text-sm font-medium">Manhwas (Corée du Sud)</span>
                  </CommandItem>

                  <CommandItem
                    value="type-manhua"
                    onSelect={() => handleSelect(() => navigate('/search?type=manhua'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                    data-testid="command-filter-manhua"
                  >
                    <span className="text-base shrink-0">🇨🇳</span>
                    <span className="text-sm font-medium">Manhuas (Chine)</span>
                  </CommandItem>

                  <CommandItem
                    value="type-manga"
                    onSelect={() => handleSelect(() => navigate('/search?type=manga'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                    data-testid="command-filter-manga"
                  >
                    <span className="text-base shrink-0">🇯🇵</span>
                    <span className="text-sm font-medium">Mangas (Japon)</span>
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator className="bg-white/[0.06] my-1" />

                {/* Tendances & Découverte */}
                <CommandGroup heading="Découverte" className="text-white/40">
                  <CommandItem
                    value="sort-recent"
                    onSelect={() => handleSelect(() => navigate('/search?sort=recent'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                  >
                    <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-sm font-medium">Derniers ajouts au catalogue</span>
                  </CommandItem>

                  <CommandItem
                    value="sort-rating"
                    onSelect={() => handleSelect(() => navigate('/search?sort=rating'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                  >
                    <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm font-medium">Les mieux notés</span>
                  </CommandItem>

                  <CommandItem
                    value="sort-popularity"
                    onSelect={() => handleSelect(() => navigate('/search?sort=popularity'))}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer text-white/90 data-[selected=true]:bg-white/[0.08]"
                  >
                    <Flame className="h-4 w-4 text-[var(--mw-accent-coral)] shrink-0" />
                    <span className="text-sm font-medium">Les plus populaires</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>

          {/* Footer bar */}
          <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2.5 text-xs text-white/40 bg-black/20">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-white/[0.06] border border-white/[0.1] px-1.5 py-0.5 rounded text-[10px]">
                  ↑
                </kbd>
                <kbd className="font-mono bg-white/[0.06] border border-white/[0.1] px-1.5 py-0.5 rounded text-[10px]">
                  ↓
                </kbd>
                <span className="ml-1">Naviguer</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="font-mono bg-white/[0.06] border border-white/[0.1] px-1.5 py-0.5 rounded text-[10px]">
                  ↵
                </kbd>
                <span className="ml-1">Sélectionner</span>
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1">
              Raccourci : <kbd className="font-mono bg-white/[0.06] border border-white/[0.1] px-1.5 py-0.5 rounded text-[10px] text-white/70">{shortcutLabel}</kbd>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

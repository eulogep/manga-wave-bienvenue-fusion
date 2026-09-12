import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import {
  isPlatformMac,
  getShortcutLabel,
  shouldEnableCommandSearch,
} from '@/domain/commandSearch';

export { isPlatformMac, getShortcutLabel, shouldEnableCommandSearch };

export interface CommandSearchContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  openWithQuery: (query?: string) => void;
  initialQuery: string;
  shortcutLabel: string;
}

const CommandSearchContext = createContext<CommandSearchContextValue | null>(null);

export function CommandSearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');
  const location = useLocation();

  const shortcutLabel = useMemo(() => getShortcutLabel(), []);

  const toggle = useCallback(() => {
    if (!shouldEnableCommandSearch(location.pathname)) return;
    setIsOpen((prev) => !prev);
  }, [location.pathname]);

  const openWithQuery = useCallback((query = '') => {
    if (!shouldEnableCommandSearch(location.pathname)) return;
    setInitialQuery(query);
    setIsOpen(true);
  }, [location.pathname]);

  // Global keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (!shouldEnableCommandSearch(window.location.pathname)) return;
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close palette whenever route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      toggle,
      openWithQuery,
      initialQuery,
      shortcutLabel,
    }),
    [isOpen, toggle, openWithQuery, initialQuery, shortcutLabel]
  );

  return (
    <CommandSearchContext.Provider value={value}>
      {children}
    </CommandSearchContext.Provider>
  );
}

export function useCommandSearch(): CommandSearchContextValue {
  const context = useContext(CommandSearchContext);
  if (!context) {
    throw new Error('useCommandSearch must be used within a CommandSearchProvider');
  }
  return context;
}

'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'blog.theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitial(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  /* BUG FIX: this used to initialise to 'light' and then a mount effect wrote
   * that value back to localStorage. Because switching locale remounts the
   * whole [locale] layout (and therefore this provider), every language change
   * silently reset a dark-mode user to light and persisted it.
   *
   * Reading lazily in the initializer means a remount restores the stored theme
   * immediately, and the persisted write below only ever stores a value the
   * user (or the system preference) actually chose. There is no hydration
   * mismatch because the theme class is applied to <html> by an effect and by
   * the pre-paint inline script, never rendered into the React tree. */
  const [theme, setThemeState] = useState<Theme>(() => readInitial());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

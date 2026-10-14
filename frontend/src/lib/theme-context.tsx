'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import {
  applyTheme,
  CATALOG_KEY,
  DEFAULT_THEMES,
  isThemeCatalog,
  THEME_ID_KEY,
  type SiteTheme,
  type ThemeMode,
} from './site-themes';
export type Theme = ThemeMode;
const KEY = 'blog.theme';
export const THEMES_QUERY_KEY = ['appearance', 'themes'] as const;
interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
  colorTheme: string;
  setColorTheme: (id: string) => void;
  themes: SiteTheme[];
  catalogReady: boolean;
  catalogError: boolean;
  refreshThemes: () => Promise<SiteTheme[] | undefined>;
  publishTheme: (theme: SiteTheme) => Promise<void>;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [theme, setTheme] = useState<Theme>('light');
  const [colorTheme, setColorThemeState] = useState('jade');
  const [cached, setCached] = useState(DEFAULT_THEMES);
  const [ready, setReady] = useState(false);
  const query = useQuery({
    queryKey: THEMES_QUERY_KEY,
    queryFn: async () => {
      const catalog = await api.themes();
      if (!isThemeCatalog(catalog)) throw new Error('Invalid theme catalog');
      return catalog;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const themes = query.data ?? cached;
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      setTheme(
        stored === 'light' || stored === 'dark'
          ? stored
          : window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light',
      );
      const id = localStorage.getItem(THEME_ID_KEY);
      if (DEFAULT_THEMES.some((t) => t.id === id)) setColorThemeState(id!);
      const saved = JSON.parse(localStorage.getItem(CATALOG_KEY) ?? 'null');
      if (isThemeCatalog(saved)) setCached(saved);
    } catch {
      /* Restricted browser storage must not break the application. */
    }
    setReady(true);
    const sync = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark'))
        setTheme(e.newValue);
      if (
        e.key === THEME_ID_KEY &&
        DEFAULT_THEMES.some((t) => t.id === e.newValue)
      )
        setColorThemeState(e.newValue!);
      if (e.key === CATALOG_KEY) {
        try {
          const v = JSON.parse(e.newValue ?? 'null');
          if (isThemeCatalog(v)) client.setQueryData(THEMES_QUERY_KEY, v);
        } catch {}
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [client]);
  useEffect(() => {
    if (!ready) return;
    applyTheme(themes.find((t) => t.id === colorTheme) ?? themes[0], theme);
    try {
      localStorage.setItem(KEY, theme);
      localStorage.setItem(THEME_ID_KEY, colorTheme);
      localStorage.setItem(CATALOG_KEY, JSON.stringify(themes));
    } catch {}
  }, [ready, theme, colorTheme, themes]);
  const setColorTheme = useCallback((id: string) => {
    if (DEFAULT_THEMES.some((t) => t.id === id)) setColorThemeState(id);
  }, []);
  const toggle = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );
  const refreshThemes = useCallback(async () => {
    const result = await query.refetch();
    return result.data;
  }, [query.refetch]);
  const publishTheme = useCallback(
    async (updated: SiteTheme) => {
      await client.cancelQueries({ queryKey: THEMES_QUERY_KEY });
      client.setQueryData<SiteTheme[]>(THEMES_QUERY_KEY, (old) =>
        (old ?? DEFAULT_THEMES).map((t) => (t.id === updated.id ? updated : t)),
      );
    },
    [client],
  );
  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggle,
        colorTheme,
        setColorTheme,
        themes,
        catalogReady: !!query.data,
        catalogError: query.isError,
        refreshThemes,
        publishTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme requires ThemeProvider');
  return ctx;
}

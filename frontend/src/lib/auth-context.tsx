'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onSessionLost, tokenStore } from '@/lib/api';
import type { LoginPayload, RegisterPayload, User } from '@/lib/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** True once the initial /auth/me probe has settled. */
  isReady: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  /** Merge a partial user (after profile edits) without refetching. */
  patchUser: (patch: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* The last successfully-probed user, so a remount (locale change, HMR, back/
 * forward) can paint the signed-in chrome immediately instead of flashing a
 * Login button while /auth/me round-trips again. Re-validated on every mount. */
const ME_CACHE = 'blog.me';
function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ME_CACHE);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  /* HYDRATION SAFETY: the cached user is applied in an EFFECT, never in the
   * useState initializer. Reading sessionStorage during the first client render
   * would make the client tree differ from the server's (which has no window)
   * and React would tear the tree down with a hydration mismatch. Starting at
   * null on both sides keeps first paint identical; the effect then restores
   * the signed-in chrome a tick later, still long before any user interaction. */
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  /* Restore the cached session right after hydration, then keep the cache in
   * step with the live session. */
  useEffect(() => {
    const cached = readCachedUser();
    if (cached) setUser((prev) => prev ?? cached);
  }, []);

  useEffect(() => {
    try {
      if (user && status === 'authenticated') sessionStorage.setItem(ME_CACHE, JSON.stringify(user));
      else if (status === 'anonymous') sessionStorage.removeItem(ME_CACHE);
    } catch { /* private mode — cache is best-effort */ }
  }, [user, status]);

  /** Probe the session once on mount if we have a stored access token. */
  useEffect(() => {

    if (!tokenStore.access) {
      setUser(null);
      setStatus('anonymous');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        // api.me() already attempted a refresh; if we're still here the
        // session is gone.
        tokenStore.clear();
        setUser(null);
        setStatus('anonymous');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  /** React to a dead refresh token (fired from the API layer). */
  useEffect(() => {
    return onSessionLost(() => {
      queryClient.clear();
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await api.login(payload);
    queryClient.clear();
    tokenStore.set(res.accessToken, res.refreshToken);
    setUser(res.user);
    setStatus('authenticated');
    return res.user;
  }, [queryClient]);

  const register = useCallback(async (payload: RegisterPayload) => {
    // The backend issues tokens on register AND creates the Redis session,
    // so the user is effectively signed in immediately.
    const res = await api.register(payload);
    queryClient.clear();
    tokenStore.set(res.accessToken, res.refreshToken);
    setUser(res.user);
    setStatus('authenticated');
    return res.user;
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      if (tokenStore.access) await api.logout();
    } catch {
      // Best-effort: the local session is cleared either way.
    } finally {
      queryClient.clear();
      tokenStore.clear();
      setUser(null);
      setStatus('anonymous');
    }
  }, [queryClient]);

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      setStatus('authenticated');
    } catch {
      /* keep the current state */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isReady: status !== 'loading',
      isAuthenticated: status === 'authenticated' && !!user,
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      patchUser,
      refreshUser,
    }),
    [user, status, login, register, logout, patchUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

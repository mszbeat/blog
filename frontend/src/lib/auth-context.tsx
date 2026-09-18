'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const booted = useRef(false);

  /** Probe the session once on mount if we have a stored access token. */
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    if (!tokenStore.access) {
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
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const res = await api.login(payload);
    tokenStore.set(res.accessToken, res.refreshToken);
    setUser(res.user);
    setStatus('authenticated');
    return res.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    // The backend issues tokens on register AND creates the Redis session,
    // so the user is effectively signed in immediately.
    const res = await api.register(payload);
    tokenStore.set(res.accessToken, res.refreshToken);
    setUser(res.user);
    setStatus('authenticated');
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (tokenStore.access) await api.logout();
    } catch {
      // Best-effort: the local session is cleared either way.
    } finally {
      tokenStore.clear();
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

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

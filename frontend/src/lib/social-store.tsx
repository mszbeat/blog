'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from './auth-context';
import { EMPTY_SOCIAL, SocialStore, type PostSocial } from './social-state';
export type { PostSocial } from './social-state';

const Context = createContext<SocialStore | null>(null);

export function SocialStoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // A different account must never inherit the previous account's relationships.
  const store = useMemo(() => new SocialStore(), [user?.id]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export function useSocialStore() {
  const store = useContext(Context);
  if (!store) throw new Error('SocialStoreProvider is missing');
  return store;
}

export function usePostSocial(postId: string, _owner: string, seed: Partial<PostSocial> = {}): PostSocial {
  const store = useSocialStore();
  const { liked, likeCount, commentCount } = seed;
  const subscribe = useCallback((fn: () => void) => store.subscribe(postId, fn), [store, postId]);
  const snapshot = useCallback(() => store.read(postId), [store, postId]);
  // SSR always uses this component's props. No cross-component render writes.
  const serverSnapshot = useCallback(() => EMPTY_SOCIAL, []);
  const live = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => {
    store.initialize(postId, { liked, likeCount, commentCount });
  }, [store, postId, liked, likeCount, commentCount]);
  return useMemo(() => ({
    liked: live.liked ?? liked ?? false,
    likeCount: live.likeCount ?? likeCount ?? 0,
    commentCount: live.commentCount ?? commentCount ?? 0,
  }), [live, liked, likeCount, commentCount]);
}

export function useFollowState(targetId: string, seed: boolean): boolean {
  const store = useSocialStore();
  const subscribe = useCallback((fn: () => void) => store.subscribe(`follow:${targetId}`, fn), [store, targetId]);
  const snapshot = useCallback(() => store.readFollow(targetId), [store, targetId]);
  const serverSnapshot = useCallback(() => undefined, []);
  const live = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => { store.initializeFollow(targetId, seed); }, [store, targetId, seed]);
  return live ?? seed;
}

import React, { StrictMode } from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/lib/auth-context';
import { SocialStoreProvider, usePostSocial, useSocialStore } from '../src/lib/social-store';
import { api } from '../src/lib/api';
import type { SocialStore } from '../src/lib/social-state';
import type { User } from '../src/lib/types';

// Deliberately run the REAL provider/hook lifecycle in React StrictMode.
// Only the auth HTTP boundary is replaced in this unit test; browser tests use Nest.
test('StrictMode auth probe completes and duplicate post mounts cannot loop', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const values = new Map<string, string>([['blog.accessToken', 'unit-test-token']]);
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) };
  Object.assign(globalThis, { window: {}, localStorage: storage, sessionStorage: storage });
  const oldMe = api.me;
  api.me = async () => ({ id: 'viewer', name: 'Viewer', role: 'user' } as User);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let store!: SocialStore;
  let ready = false;
  let renders = 0;
  function Probe({ liked }: { liked: boolean }) {
    if (++renders > 100) throw new Error('Unexpected render loop');
    store = useSocialStore();
    ready = useAuth().isReady;
    const state = usePostSocial('post', 'duplicate', { liked, likeCount: liked ? 9 : 0 });
    return <span>{`${state.liked}:${state.likeCount}`}</span>;
  }
  function Tree({ detail = false }: { detail?: boolean }) {
    return <StrictMode><QueryClientProvider client={qc}><AuthProvider><SocialStoreProvider>
      <Probe key={detail ? 'detail' : 'feed'} liked={false} />
      <Probe liked={true} />
    </SocialStoreProvider></AuthProvider></QueryClientProvider></StrictMode>;
  }
  let root!: ReactTestRenderer;
  try {
    await act(async () => { root = create(<Tree />); });
    assert.equal(ready, true, 'StrictMode cleanup must not leave auth loading forever');
    await act(async () => { store.setLiked('post', true); });
    const count = store.read('post').likeCount;
    await act(async () => { root.update(<Tree detail />); });
    await act(async () => { root.update(<Tree />); });
    assert.equal(store.read('post').liked, true);
    assert.equal(store.read('post').likeCount, count);
    assert.ok(renders < 100);
  } finally {
    await act(async () => root?.unmount());
    qc.clear();
    api.me = oldMe;
  }
});

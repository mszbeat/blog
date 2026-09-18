'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SearchX, UserRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card } from '@/components/ui/primitives';
import { PostsGrid } from '@/components/profile/posts-grid';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { Locale, Post, User } from '@/lib/types';

/**
 * Shown when a user could NOT be reconstructed from public posts.
 *
 * `GET /users/:id` is behind JwtAuthGuard, so we retry it client-side: if the
 * visitor happens to be logged in (and especially if they ARE this user, or an
 * admin) the profile resolves normally. Otherwise we show a friendly
 * "no public activity yet" state instead of a hard 404 — the user may well
 * exist, they just have nothing published.
 */
export function ProfileAuthFallback({ userId }: { userId: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('profile');
  const tp = useTranslations('posts');
  const tc = useTranslations('common');
  const tur = useTranslations('users');
  const { isAuthenticated, isReady } = useAuth();

  /*
   * Starts as 'notfound' on purpose: that is what the server renders, so the
   * first client paint matches the SSR HTML exactly (no hydration mismatch and
   * no skeleton flash for the overwhelmingly common anonymous visitor).
   * Only once we know the visitor IS authenticated do we flip to 'loading'
   * and retry the guarded endpoint.
   */
  const [state, setState] = useState<'loading' | 'found' | 'notfound'>('notfound');
  const [user, setUser] = useState<User | null>(null);
  const [posts] = useState<Post[]>([]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return; // stay on the public "not found" state
    let alive = true;
    setState('loading');

    (async () => {
      try {
        const u = await api.user(userId);
        if (!alive) return;
        setUser(u);
        // `/post/my` only lists *your own* posts, so for someone else we simply
        // have nothing more to show; for yourself we can pull the drafts too.
        setState('found');
      } catch {
        if (alive) setState('notfound');
      }
    })();

    return () => { alive = false; };
  }, [userId, isAuthenticated, isReady]);

  /* ── Loading (only reachable for an authenticated visitor) ── */
  if (state === 'loading') {
    return (
      <div className="animate-pulse">
        <div className="skeleton mx-auto h-32 w-32 rounded-full" />
        <div className="skeleton mx-auto mt-5 h-6 w-48" />
        <div className="skeleton mx-auto mt-3 h-4 w-72" />
        <div className="mt-10 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton aspect-square rounded-2xl" />)}
        </div>
      </div>
    );
  }

  /* ── Resolved via authenticated fetch ── */
  if (state === 'found' && user) {
    const roleKey = `role${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` as
      | 'roleAdmin' | 'roleUser' | 'roleGuest';
    return (
      <div className="pb-16">
        <div className="text-center">
          <Avatar
            src={user.avatar}
            name={user.name}
            ring
            className="mx-auto !size-32 !text-4xl shadow-elev-3"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{user.name}</h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge tone={user.role === 'admin' ? 'brand' : 'neutral'}>
              {tur(roleKey)}
            </Badge>
            <span className="num-en text-sm text-ink-3">{user.email}</span>
          </div>
          {user.bio && (
            <p className="mx-auto mt-4 max-w-lg text-sm leading-loose whitespace-pre-wrap text-ink-2">
              {user.bio}
            </p>
          )}
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <SearchX className="size-3.5" aria-hidden />
            {t('privateNotice')}
          </p>
        </div>

        <div className="mt-8">
          <PostsGrid posts={posts} />
        </div>
      </div>
    );
  }

  /* ── Nothing public, nothing reachable ── */
  return (
    <Card className="px-6 py-16 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-surface-3 text-ink-3">
        <UserRound className="size-7" aria-hidden />
      </span>

      <h1 className="mt-5 text-xl font-extrabold text-ink">
        {t('notFoundTitle')}
      </h1>

      <p className="mx-auto mt-2 max-w-md text-sm leading-loose text-ink-2">
        {t('notFoundDesc')}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <Link href="/login" className="contents">
          <Button variant="primary" size="lg">{tc('login')}</Button>
        </Link>
        <Link href="/posts" className="contents">
          <Button variant="outline" size="lg">{tp('title')}</Button>
        </Link>
      </div>
    </Card>
  );
}

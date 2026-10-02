'use client';

/**
 * People search — find someone by name or email handle and follow them.
 *
 * Debounced so typing doesn't hammer `GET /users/search`; results reuse
 * `UserRow` so the follow button, the "follows you" badge and the admin chip
 * all behave exactly as they do in follower lists.
 */

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, UserSearch, Users } from 'lucide-react';
import { useUserSearch, useMyFollowingIds, useMyFollowerIds } from '@/lib/queries';
import { UserRow } from '@/components/profile/user-row';
import { Input } from '@/components/ui/form';
import { Card, EmptyState, Skeleton } from '@/components/ui/primitives';

export default function PeoplePage() {
  const locale = useLocale();
  const t = useTranslations('people');
  const tc = useTranslations('common');

  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const search = useUserSearch(debounced);
  const following = useMyFollowingIds(true);
  const followers = useMyFollowerIds(true);

  const users = search.data ?? [];
  const loading = search.isLoading && debounced.length > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <UserSearch className="size-5" aria-hidden />
          </span>
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-ink-3">{t('subtitle')}</p>
      </header>

      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
        leadingIcon={<Search className="size-4" aria-hidden />}
        autoFocus
      />

      <div className="mt-5">
        {loading ? (
          <Card className="divide-y divide-line overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </Card>
        ) : debounced.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title={t('startTitle')}
            description={t('startDesc')}
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserSearch className="size-6" aria-hidden />}
            title={t('noResults')}
            description={t('noResultsDesc', { q: debounced })}
          />
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isFollowing={following.data?.has(u.id) ?? false}
                followsYou={followers.data?.has(u.id) ?? false}
              />
            ))}
          </Card>
        )}
      </div>

      <p className="num-en mt-4 text-center text-xs text-ink-4">
        {debounced && !loading ? tc('resultsCount', { count: users.length }) : ''}
      </p>
    </div>
  );
}

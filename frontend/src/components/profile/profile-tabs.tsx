'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarDays, FileText, Grid3x3, Heart, Info, Layers, Mail, ShieldCheck,
  UserPlus, Users,
} from 'lucide-react';
import { PostsGrid } from '@/components/profile/posts-grid';
import { FeedItem } from '@/components/feed/feed-item';
import { UserRow } from '@/components/profile/user-row';
import { Badge } from '@/components/ui/primitives';
import {
  useFollowers, useFollowing, useLikedPosts, useMyFollowerIds, useMyFollowingIds,
} from '@/lib/queries';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { Locale, Post, User } from '@/lib/types';

export type ProfileTab = 'grid' | 'feed' | 'likes' | 'followers' | 'following' | 'about';

/**
 * Tabbed body of the profile page.
 *
 *   grid        — Instagram-style squares of the author's posts
 *   feed        — the same cards as the home feed (easier to actually read)
 *   likes       — posts this user liked   (GET /users/:id/likes)
 *   followers   — who follows them        (GET /users/:id/followers)
 *   following   — who they follow         (GET /users/:id/following)
 *   about       — bio + account facts
 *
 * The social tabs are fetched LAZILY: their hooks are disabled until the tab
 * is opened, so landing on a profile costs one request, not four.
 */
export function ProfileTabs({
  user, posts, isSelf, counts, tab, onTabChange,
}: {
  user: User;
  posts: Post[];
  isSelf: boolean;
  /** Server-provided counters drive the tab badges. */
  counts: { likes: number; followers: number; following: number };
  /** Controlled so the header stat tiles can switch tabs too. */
  tab: ProfileTab;
  onTabChange: (t: ProfileTab) => void;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations('profile');
  const tp = useTranslations('posts');
  const tc = useTranslations('common');
  const tu = useTranslations('users');
  const tcat = useTranslations('categories');

  const published = posts.filter((p) => p.published);
  const drafts = posts.filter((p) => !p.published);

  // Which categories does this person actually write in?
  const catCount = new Map<string, number>();
  posts.forEach((p) =>
    (p.categories ?? []).forEach((c) => catCount.set(c.name, (catCount.get(c.name) ?? 0) + 1)),
  );
  const topCats = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const roleKey = `role${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` as
    | 'roleAdmin' | 'roleUser' | 'roleGuest';

  /* ── Lazy social data ── */
  const likesQ = useLikedPosts(user.id, tab === 'likes');
  const followersQ = useFollowers(user.id, tab === 'followers');
  const followingQ = useFollowing(user.id, tab === 'following');

  /* The viewer's own graph, fetched only while a social tab is open. The edge
   * lists return bare user records with NO relationship flag, so without these
   * every row would render as "Follow" even for people you already follow. */
  const socialOpen = tab === 'followers' || tab === 'following';
  const myFollowing = useMyFollowingIds(socialOpen);
  const myFollowers = useMyFollowerIds(socialOpen);

  // Drafts are a separate toggle rather than another tab: they only exist for
  // the author, so the public tab bar stays stable for visitors.
  const [showDrafts, setShowDrafts] = useState(false);

  /* The Likes tab is PRIVATE — `GET /users/:id/likes` now rejects anyone who
   * is not the owner, so the tab is not even offered to visitors.
   *
   * Its badge deliberately shows no number: `counts.likes` is the likes the
   * author RECEIVED on their own posts (SUM of Post.likeCount), not how many
   * posts they liked. Rendering it here was simply the wrong metric, and the
   * real total is only knowable after the private list is fetched. */
  const TABS: { id: ProfileTab; label: string; icon: typeof Grid3x3; count?: number }[] = [
    { id: 'grid', label: tp('allPosts'), icon: Grid3x3, count: published.length },
    { id: 'feed', label: t('feedView'), icon: FileText },
    ...(isSelf
      ? [{ id: 'likes' as ProfileTab, label: t('tabLikes'), icon: Heart }]
      : []),
    { id: 'followers', label: t('tabFollowers'), icon: Users, count: counts.followers },
    { id: 'following', label: t('tabFollowing'), icon: UserPlus, count: counts.following },
    { id: 'about', label: t('about'), icon: Info },
  ];

  const setTab = (id: ProfileTab) => { setShowDrafts(false); onTabChange(id); };

  const visible = showDrafts ? drafts : tab === 'feed' ? posts : published;

  return (
    <div>
      {/* ── Tab bar ── */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-surface-2/85 px-4 backdrop-blur-xl sm:mx-0 sm:rounded-t-2xl sm:border sm:border-b-0">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id && !showDrafts}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-2 px-3.5 py-3 text-sm font-bold transition sm:px-4',
                tab === id && !showDrafts ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3 hover:text-ink',
              )}
            >
              <Icon className={cn('size-4', id === 'likes' && tab === id && 'fill-plum-500 text-plum-500')} aria-hidden />
              <span className="hidden sm:inline">{label}</span>
              {typeof count === 'number' && count > 0 && (
                <span className="num-en rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-2">
                  {formatNumber(count, locale)}
                </span>
              )}
              {tab === id && !showDrafts && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
              )}
            </button>
          ))}

          {isSelf && drafts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDrafts((v) => !v)}
              aria-pressed={showDrafts}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-2 px-3.5 py-3 text-sm font-bold transition sm:px-4',
                showDrafts ? 'text-accent-600 dark:text-accent-300' : 'text-ink-3 hover:text-ink',
              )}
            >
              <FileText className="size-4" aria-hidden />
              {tp('draft')}
              <span className="num-en rounded-full bg-accent-500/14 px-1.5 py-0.5 text-[10px] font-extrabold text-accent-600 dark:text-accent-300">
                {formatNumber(drafts.length, locale)}
              </span>
              {showDrafts && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent-500" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Panel ── */}
      <div className="pt-5">
        {showDrafts ? (
          <PostsGrid posts={visible} />
        ) : tab === 'about' ? (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            {/* Bio */}
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Info className="size-4 text-brand-500" aria-hidden />
                {tc('bio')}
              </h2>
              {user.bio ? (
                <p className="mt-3 text-sm leading-loose whitespace-pre-wrap text-ink-2">{user.bio}</p>
              ) : (
                <p className="mt-3 text-sm text-ink-3">{t('noBio')}</p>
              )}

              {topCats.length > 0 && (
                <>
                  <h3 className="mt-6 flex items-center gap-2 text-sm font-bold text-ink">
                    <Layers className="size-4 text-plum-500" aria-hidden />
                    {t('writesAbout')}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topCats.map(([name, count]) => (
                      <span key={name} className="chip !cursor-default">
                        {name}
                        <span className="num-en text-[10px] opacity-70">{formatNumber(count, locale)}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Facts */}
            <section className="card divide-y divide-line">
              <Fact icon={<ShieldCheck className="size-4" aria-hidden />} label={tc('role')} value={tu(roleKey)} />
              <Fact
                icon={<CalendarDays className="size-4" aria-hidden />}
                label={t('joined')}
                value={formatDate(user.createdAt, locale, { year: 'numeric', month: 'long', day: 'numeric' })}
              />
              <Fact
                icon={<FileText className="size-4" aria-hidden />}
                label={tp('allPosts')}
                value={formatNumber(published.length, locale)}
              />
              <Fact
                icon={<Heart className="size-4" aria-hidden />}
                label={t('tabLikes')}
                value={formatNumber(counts.likes, locale)}
              />
              <Fact
                icon={<Layers className="size-4" aria-hidden />}
                label={tcat('title')}
                value={formatNumber(topCats.length, locale)}
              />
              {isSelf && (
                <Fact
                  icon={<Mail className="size-4" aria-hidden />}
                  label={tc('email')}
                  value={user.email}
                  ltr
                />
              )}
            </section>
          </div>
        ) : tab === 'likes' ? (
          /* Unreachable for visitors (the tab is not rendered), but guarded so a
           * stale `tab` value can never fire a request the backend will 403. */
          !isSelf ? null : (
          <LazyList
            loading={likesQ.isLoading}
            empty={likesQ.data?.data.length === 0}
            emptyTitle={t('noLikes')}
            emptyDesc={t('noLikesHint')}
            emptyIcon={<Heart className="size-6" aria-hidden />}
          >
            <PostsGrid posts={likesQ.data?.data ?? []} />
          </LazyList>
          )
        ) : tab === 'followers' ? (
          <LazyList
            loading={followersQ.isLoading}
            empty={followersQ.data?.data.length === 0}
            emptyTitle={t('noFollowers')}
            emptyIcon={<Users className="size-6" aria-hidden />}
          >
            <UserList
              users={followersQ.data?.data ?? []}
              followingIds={myFollowing.data}
              followerIds={myFollowers.data}
            />
          </LazyList>
        ) : tab === 'following' ? (
          <LazyList
            loading={followingQ.isLoading}
            empty={followingQ.data?.data.length === 0}
            emptyTitle={t('noFollowing')}
            emptyIcon={<UserPlus className="size-6" aria-hidden />}
          >
            <UserList
              users={followingQ.data?.data ?? []}
              followingIds={myFollowing.data}
              followerIds={myFollowers.data}
            />
          </LazyList>
        ) : tab === 'feed' ? (
          <div className="mx-auto max-w-2xl space-y-4">
            {visible.length === 0 ? (
              <div className="card py-16 text-center">
                <p className="text-sm text-ink-3">{tp('noPosts')}</p>
              </div>
            ) : (
              visible.map((post) => <FeedItem key={post.id} post={post} locale={locale} />)
            )}
          </div>
        ) : (
          <PostsGrid posts={visible} />
        )}
      </div>
    </div>
  );
}

/** Dense list of users (followers / following). */
function UserList({
  users, followingIds, followerIds,
}: {
  users: User[];
  followingIds?: Set<string>;
  followerIds?: Set<string>;
}) {
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {users.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          isFollowing={followingIds?.has(u.id) ?? false}
          followsYou={followerIds?.has(u.id) ?? false}
        />
      ))}
    </div>
  );
}

/** Shared loading / empty shell for the lazily-fetched social tabs. */
function LazyList({
  loading, empty, emptyTitle, emptyDesc, emptyIcon, children,
}: {
  loading: boolean;
  empty: boolean;
  emptyTitle: string;
  emptyDesc?: string;
  emptyIcon: React.ReactNode;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton aspect-square rounded-xl sm:rounded-2xl" />
        ))}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-3 text-ink-3">
          {emptyIcon}
        </span>
        <p className="text-sm font-bold text-ink">{emptyTitle}</p>
        {emptyDesc && <p className="max-w-sm text-xs text-ink-3">{emptyDesc}</p>}
      </div>
    );
  }
  return <>{children}</>;
}

function Fact({
  icon, label, value, ltr,
}: { icon: React.ReactNode; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-3">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</span>
        <span
          className={cn('mt-0.5 block truncate text-sm font-semibold text-ink', ltr && 'num-en')}
          dir={ltr ? 'ltr' : undefined}
        >
          {value}
        </span>
      </span>
      <Badge tone="neutral" className="!px-2 !py-0.5 !text-[10px]">·</Badge>
    </div>
  );
}

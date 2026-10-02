'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarDays, Eye, FileText, Heart, Mail, PenSquare, Settings2, UserPlus, Users,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/primitives';
import { ShareButton } from '@/components/share-button';
import { FollowButton } from '@/components/social/follow-button';
import { useAuth } from '@/lib/auth-context';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { Locale, PublicProfile, User } from '@/lib/types';

/**
 * Profile identity block.
 *
 * Everything that identifies or acts on the account sits in ONE horizontal
 * row — avatar, name, then the actions — instead of the previous two-tier
 * layout where the name lived below the avatar and the buttons floated off to
 * the side. On a narrow screen the row wraps rather than squeezing.
 *
 * Driven by the aggregate `GET /users/:id/public` payload, so the counters are
 * REAL (posts / views / likes received / followers / following) rather than
 * derived from whatever posts happened to be on the page.
 *
 * Client component because the follow button and the self/visitor distinction
 * depend on the signed-in user, which is only known after hydration.
 */
export function ProfileHeader({
  user, stats, isFollowing, isSelf, onStatClick, activeStat,
}: {
  user: User;
  stats: PublicProfile['stats'];
  isFollowing: boolean;
  isSelf: boolean;
  /** Lets the follower/following counters act as tab switches. */
  onStatClick?: (tab: 'followers' | 'following') => void;
  activeStat?: 'followers' | 'following' | null;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const tp = useTranslations('posts');
  const tu = useTranslations('users');
  const { user: me } = useAuth();

  // Prefer the live auth context over the server-passed flag: SSR can't know
  // the viewer, so `isSelf` from the server is always false.
  const self = me?.id === user.id || isSelf;

  const roleKey = `role${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` as
    | 'roleAdmin' | 'roleUser' | 'roleGuest';

  const counters = [
    { key: 'posts', label: t('statPosts'), value: stats.posts, icon: FileText },
    { key: 'views', label: t('statViews'), value: stats.views, icon: Eye },
    { key: 'likes', label: t('statLikes'), value: stats.likes, icon: Heart },
    { key: 'followers', label: t('statFollowers'), value: stats.followers, icon: Users, tab: 'followers' as const },
    { key: 'following', label: t('statFollowing'), value: stats.following, icon: UserPlus, tab: 'following' as const },
  ];

  return (
    /* No banner above any more, so nothing is pulled up over anything: the
     * identity row simply starts the page. (The old `-mt-10` + `relative z-10`
     * pair existed only to lift this block out of the coloured band, and that
     * band is what made the avatar look half-swallowed.) */
    <header>
      {/* ══════ ONE horizontal row: avatar · name · actions ══════ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Avatar
          src={user.avatar}
          name={user.name}
          className="!size-20 !text-2xl shadow-elev-3 sm:!size-24 sm:!text-3xl"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              {user.name}
            </h1>
            <Badge tone={user.role === 'admin' ? 'brand' : 'neutral'} className="!text-xs">
              {tu(roleKey)}
            </Badge>
          </div>
          <p className="num-en mt-0.5 truncate text-sm font-semibold text-ink-3">
            @{user.email.split('@')[0]}
          </p>
        </div>

        {/* Actions live on the same line as the identity, never below it. */}
        <div className="flex flex-wrap items-center gap-2">
          {self ? (
            <>
              <Link href="/dashboard/posts/new" className="contents">
                <Button size="lg" variant="outline" className="gap-2">
                  <PenSquare className="size-4" aria-hidden />
                  {tp('newPost')}
                </Button>
              </Link>
              <Link href="/dashboard/profile" className="contents">
                <Button size="lg" variant="primary" className="gap-2">
                  <Settings2 className="size-4" aria-hidden />
                  {t('editProfile')}
                </Button>
              </Link>
            </>
          ) : (
            <FollowButton targetId={user.id} isFollowing={isFollowing} size="lg" />
          )}

          <ShareButton
            variant="outline"
            size="lg"
            title={user.name}
            url={typeof window !== 'undefined' ? window.location.href : undefined}
            label={tc('share')}
          />
        </div>
      </div>

      {/* ══════ Bio + facts ══════ */}
      <div className="mt-4 max-w-2xl">
        {user.bio ? (
          <p className="text-[15px] leading-loose whitespace-pre-wrap text-ink-2">{user.bio}</p>
        ) : (
          <p className="text-sm italic text-ink-3">{t('noBioShort')}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            {t('joined')}{' '}
            <span className="font-semibold text-ink-2">
              {formatDate(user.createdAt, locale, { year: 'numeric', month: 'long' })}
            </span>
          </span>
          {/* Only the owner (or an admin viewing via the client re-read) sees the
              address — it is never part of the public payload. */}
          {self && (
            <span className="num-en inline-flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden />
              {user.email}
            </span>
          )}
        </div>
      </div>

      {/* ══════ Counters — follower/following double as tab switches ══════ */}
      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-elev-1 sm:grid-cols-5">
        {counters.map(({ key, label, value, icon: Icon, tab }) => {
          const clickable = !!tab && !!onStatClick;
          const active = !!tab && activeStat === tab;
          return (
            <button
              key={key}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStatClick?.(tab!)}
              aria-pressed={active}
              className={cn(
                'relative bg-surface px-2 py-4 text-center transition',
                clickable && 'cursor-pointer hover:bg-surface-2',
                active && 'bg-brand-500/8',
                !clickable && 'cursor-default',
              )}
            >
              <Icon
                className={cn('mx-auto mb-1.5 size-4', active ? 'text-brand-600 dark:text-brand-300' : 'text-brand-500')}
                aria-hidden
              />
              <span className="num-en block text-lg font-extrabold text-ink sm:text-xl">
                {formatNumber(value, locale)}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-ink-3">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Hairline divider so the header separates from the tabs below */}
      <div aria-hidden className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-line-strong to-transparent" />
    </header>
  );
}

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, Check, Eye, FileText, Mail, Settings2, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/primitives';
import { ShareButton } from '@/components/share-button';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatNumber } from '@/lib/utils';
import type { Locale, User } from '@/lib/types';

/**
 * Instagram-style identity block: large ringed avatar pulled up over the
 * banner, name + role, bio, stat counters and actions.
 * Client component because it needs to know whether the viewer *is* this user
 * (to swap "Share" for "Edit profile").
 */
export function ProfileHeader({
  user, stats,
}: {
  user: User;
  stats: { posts: number; views: number; published: number };
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const tu = useTranslations('users');
  const tp = useTranslations('posts');
  const { user: me } = useAuth();

  const isSelf = me?.id === user.id;
  const roleKey = `role${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` as
    | 'roleAdmin' | 'roleUser' | 'roleGuest';

  const counters = [
    { label: tp('allPosts'), value: stats.published, icon: FileText },
    { label: tc('views'), value: stats.views, icon: Eye },
    { label: tc('following'), value: 0, icon: ShieldCheck, soon: true },
  ];

  return (
    <header className="-mt-16 sm:-mt-20">
      {/* Avatar row */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <Avatar
            src={user.avatar}
            name={user.name}
            ring
            className="!size-28 !text-3xl shadow-elev-3 sm:!size-36 sm:!text-4xl"
          />
          <div className="mb-1 min-w-0 sm:hidden">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{user.name}</h1>
            {user.role === 'admin' && <Badge tone="brand">{tu(roleKey)}</Badge>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isSelf ? (
            <Link href="/dashboard/profile" className="contents">
              <Button size="lg" variant="primary" className="gap-2">
                <Settings2 className="size-4" aria-hidden />
                {t('editProfile')}
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              variant="primary"
              className="gap-2"
              disabled
              title={t('followSoon')}
            >
              <Check className="size-4" aria-hidden />
              {t('follow')}
            </Button>
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

      {/* Name / bio / facts */}
      <div className="mt-4 max-w-2xl">
        <div className="hidden items-center gap-2.5 sm:flex">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{user.name}</h1>
          {user.role === 'admin' ? (
            <Badge tone="brand" className="!text-xs">{tu(roleKey)}</Badge>
          ) : (
            <Badge tone="neutral" className="!text-xs">{tu(roleKey)}</Badge>
          )}
        </div>

        <p className="num-en mt-1 text-sm font-semibold text-ink-3">@{user.email.split('@')[0]}</p>

        {user.bio ? (
          <p className="mt-3 text-[15px] leading-loose whitespace-pre-wrap text-ink-2">{user.bio}</p>
        ) : (
          <p className="mt-3 text-sm italic text-ink-3">
            {t('noBioShort')}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            {t('joined')}{' '}
            <span className="font-semibold text-ink-2">
              {formatDate(user.createdAt, locale, { year: 'numeric', month: 'long' })}
            </span>
          </span>
          {isSelf && (
            <span className="num-en inline-flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden />
              {user.email}
            </span>
          )}
        </div>
      </div>

      {/* Counters */}
      <div className="mt-6 grid grid-cols-3 divide-x divide-x-reverse divide-line overflow-hidden rounded-2xl border border-line bg-surface-1 shadow-elev-1">
        {counters.map(({ label, value, icon: Icon, soon }) => (
          <div key={label} className="relative px-2 py-4 text-center">
            {soon && (
              <span className="absolute top-1.5 rounded-full bg-surface-3 px-1.5 py-px text-[9px] font-bold text-ink-3" style={{ insetInlineEnd: '0.375rem' }}>
                {tc('soon')}
              </span>
            )}
            <Icon className="mx-auto mb-1.5 size-4 text-brand-500" aria-hidden />
            <span className="num-en block text-xl font-extrabold text-ink sm:text-2xl">
              {formatNumber(value, locale)}
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-ink-3">{label}</span>
          </div>
        ))}
      </div>

      {/* Hairline divider so the header separates from the tabs below */}
      <div aria-hidden className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-line-strong to-transparent" />
    </header>
  );
}

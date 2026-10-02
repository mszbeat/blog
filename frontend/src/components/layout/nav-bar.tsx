'use client';

/**
 * The universal navigation bar.
 *
 *   • Mobile : a full-width bar pinned to the viewport bottom (Instagram-style),
 *              with `env(safe-area-inset-bottom)` padding for the home indicator.
 *   • Desktop: the same five targets as a floating glass dock centred above the
 *              bottom edge, so the primary actions are always one click away
 *              without crowding the header.
 *
 * Targets: Home · People · New post (raised) · Profile · SETTINGS.
 * The last slot used to open the menu drawer; settings now lives here directly,
 * which removes a hop and keeps a single entry point for preferences.
 * Notifications deliberately stay in the header, next to the logo.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Home, Plus, Settings as SettingsIcon, User as UserIcon, UserSearch } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { SettingsDialog } from '@/components/settings-dialog';
import { cn } from '@/lib/utils';

export function NavBar() {
  const t = useTranslations('nav');
  const tp = useTranslations('people');
  const ts = useTranslations('settings');
  const pathname = usePathname();
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const profileHref = user ? `/users/${user.id}` : '/login';
  const isActive = (href: string, exact = false) =>
    exact ? pathname === '/' : pathname.startsWith(href);

  const tile = (href: string, label: string, Icon: typeof Home, active: boolean, fab = false) => {
    if (fab) {
      return (
        <Link key="new" href={href} aria-label={label} className="group flex flex-col items-center gap-1">
          <span className="satin -mt-5 flex size-12 items-center justify-center rounded-2xl text-white shadow-brand ring-4 ring-surface transition group-active:scale-95 md:-mt-8 md:size-11 md:rounded-xl">
            <Icon className="size-5" aria-hidden />
          </span>
        </Link>
      );
    }
    return (
      <Link
        key={href}
        href={href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition',
          active ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3 hover:text-ink',
        )}
      >
        <Icon className={cn('size-[22px]', active && 'fill-brand-500/15')} aria-hidden />
        <span className={cn('text-[10px] max-md:block md:hidden', active ? 'font-extrabold' : 'font-bold')}>{label}</span>
      </Link>
    );
  };

  /* Settings replaces the old "more/menu" slot: same position, one tap fewer. */
  const settingsButton = (
    <button
      type="button"
      onClick={() => setSettingsOpen(true)}
      aria-label={ts('title')}
      aria-haspopup="dialog"
      className="flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-ink-3 transition hover:text-ink"
    >
      <SettingsIcon className="size-[22px]" aria-hidden />
      <span className="text-[10px] font-bold max-md:block md:hidden">{t('settings')}</span>
    </button>
  );

  const items = [
    { key: 'home', href: '/', label: t('home'), icon: Home, exact: true },
    { key: 'people', href: '/people', label: tp('navPeople'), icon: UserSearch, exact: false },
    { key: 'new', href: '/dashboard/posts/new', label: t('newPost'), icon: Plus, fab: true },
    { key: 'profile', href: profileHref, label: t('profile'), icon: UserIcon, exact: false },
  ];

  return (
    <>
      {/* ── Mobile bar ── */}
      <nav
        aria-label="bottom"
        className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pb-1.5 pt-1.5">
          {items.map((i) => tile(i.href, i.label, i.icon, isActive(i.href, !!i.exact), !!i.fab))}
          {settingsButton}
        </div>
      </nav>

      {/* ── Desktop floating dock ── */}
      <nav
        aria-label="dock"
        className="fixed bottom-5 left-1/2 z-40 hidden -translate-x-1/2 items-end gap-1 rounded-2xl border border-line bg-surface/85 px-3 pb-2 pt-2 shadow-elev-3 backdrop-blur-xl md:flex"
      >
        {items.map((i) => tile(i.href, i.label, i.icon, isActive(i.href, !!i.exact), !!i.fab))}
        {settingsButton}
      </nav>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

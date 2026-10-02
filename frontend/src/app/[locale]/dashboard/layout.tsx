'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  ExternalLink, LayoutDashboard, PenSquare, Plus, Settings, Shield,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { Avatar, Badge } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/types';

/**
 * Authenticated area shell.
 * The backend has no server-side session (Bearer tokens live in localStorage),
 * so gating happens client-side through <AuthGuard>.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Shell>{children}</Shell>
    </AuthGuard>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dashboard');
  const tn = useTranslations('nav');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();

  const links = [
    { href: '/dashboard', label: t('sections.overview'), icon: LayoutDashboard, exact: true },
    { href: '/dashboard/posts', label: tn('myPosts'), icon: PenSquare },
    { href: '/dashboard/profile', label: t('sections.profile'), icon: Settings },
    ...(isAdmin ? [{ href: '/admin', label: t('sections.admin'), icon: Shield }] : []),
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Identity bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar src={user?.avatar} name={user?.name} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-ink">
              {t('welcome', { name: user?.name ?? '' })}
            </h1>
            <p className="truncate text-sm text-ink-3">{t('welcomeSub')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Badge tone={isAdmin ? 'brand' : 'neutral'} icon={<Shield className="size-3" aria-hidden />}>
              {user.role}
            </Badge>
          )}
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:border-brand-400 hover:text-brand-600"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {t('viewSite')}
          </Link>
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[13rem_1fr]">
        {/* Sidebar — horizontal chip row on small screens.
            The identity line lives INSIDE the sticky wrapper so it scrolls with
            the menu instead of disappearing off the top of the page. */}
        <aside>
          <div className="lg:sticky lg:top-24">
          <nav
            aria-label={locale === 'fa' ? 'منوی داشبورد' : 'Dashboard menu'}
            className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:rounded-2xl lg:border lg:border-line lg:bg-surface lg:p-2 lg:shadow-elev-1"
          >
            {links.map(({ href, label, icon: Icon, exact }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href, exact) ? 'page' : undefined}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
                  isActive(href, exact)
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                    : 'text-ink-2 hover:bg-surface hover:text-ink lg:hover:bg-surface',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>

            {/* Signed-in identity, pinned with the keys above it. */}
            <div className="mt-2 hidden lg:block">
              <div className="rounded-2xl border border-line bg-surface p-3 shadow-elev-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                  {tc('appName')}
                </p>
                <p className="num-en mt-1 truncate text-xs font-semibold text-ink-2" dir="ltr" title={user?.email}>
                  {user?.email}
                </p>
              </div>

              <Link
                href="/dashboard/posts/new"
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
              >
                <Plus className="size-4" aria-hidden />
                {tn('newPost')}
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

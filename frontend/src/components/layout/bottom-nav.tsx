'use client';

/**
 * Instagram-style bottom navigation (mobile only).
 *
 * Four destinations, thumb-reachable: Home, People search, a raised "+" for
 * writing, and your profile. Notifications deliberately stay in the header so
 * the bar never grows past four targets.
 *
 * Fixed to the viewport bottom with `env(safe-area-inset-bottom)` padding so
 * it clears the iOS home indicator, and the page adds matching bottom padding
 * so content is never hidden behind it.
 */

import { useTranslations } from 'next-intl';
import { Home, Plus, User as UserIcon, UserSearch } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const t = useTranslations('nav');
  const tp = useTranslations('people');
  const pathname = usePathname();
  const { user } = useAuth();

  const profileHref = user ? `/users/${user.id}` : '/login';

  const items = [
    { href: '/', label: t('home'), icon: Home, exact: true },
    { href: '/people', label: tp('navPeople'), icon: UserSearch, exact: false },
    { href: '/dashboard/posts/new', label: t('newPost'), icon: Plus, exact: false, fab: true },
    { href: profileHref, label: t('profile'), icon: UserIcon, exact: false },
  ];

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav
      aria-label="bottom"
      className="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 items-end px-2 pb-1.5 pt-1.5">
        {items.map(({ href, label, icon: Icon, exact, fab }) => {
          const active = isActive(href, exact);
          if (fab) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="group flex flex-col items-center gap-1"
              >
                <span className="satin -mt-5 flex size-12 items-center justify-center rounded-2xl text-white shadow-brand ring-4 ring-surface transition group-active:scale-95">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-[10px] font-bold text-ink-3">{label}</span>
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
                'flex flex-col items-center gap-1 rounded-xl py-1 transition',
                active ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3 hover:text-ink',
              )}
            >
              <Icon className={cn('size-[22px]', active && 'fill-brand-500/15')} aria-hidden />
              <span className={cn('text-[10px]', active ? 'font-extrabold' : 'font-bold')}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

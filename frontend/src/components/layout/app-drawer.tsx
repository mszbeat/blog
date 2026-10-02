'use client';

/**
 * The one navigation drawer, opened by the header's menu button AND by the
 * navbar's "more" button (see drawer-context).
 *
 * Slides in from the inline-END edge and stops at half the viewport on phones
 * (a fixed 20rem on larger screens, where half would be absurdly wide). A tap
 * on the dimmed page, the X, or Escape all dismiss it.
 *
 * Settings lives HERE rather than in the header, per the redesign: the header
 * stays a thin brand+bell+account strip and every preference gathers behind
 * one drawer entry.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  AtSign, Layers, LayoutDashboard, LogOut, PenSquare, Shield, X,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDrawer } from '@/lib/drawer-context';
import { Avatar, Badge } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function AppDrawer() {
  const { open, closeDrawer } = useDrawer();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeDrawer]);

  // Close on navigation so a picked link never leaves the panel hanging open.
  useEffect(() => { closeDrawer(); }, [pathname, closeDrawer]);

  const links = [
    { href: '/', label: t('home') },
    { href: '/posts', label: t('blog') },
    { href: '/categories', label: t('categories') },
  ];
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      <div className={cn('fixed inset-0 z-[130]', !open && 'pointer-events-none')} aria-hidden={!open}>
        {/* Backdrop — tap outside to dismiss. */}
        <div
          onClick={closeDrawer}
          className={cn(
            'absolute inset-0 bg-slate-950/55 backdrop-blur-sm transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden
        />

        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'absolute inset-y-0 end-0 flex w-1/2 min-w-[13.5rem] flex-col border-s border-line bg-surface shadow-2xl shadow-black/30 sm:w-80',
            'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            open ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-ink-3">{tc('appName')}</span>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-lg p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink"
              aria-label={tc('close')}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <nav className="flex flex-col gap-1" aria-label="drawer">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    isActive(l.href)
                      ? 'bg-brand-500/12 text-brand-700 dark:text-brand-300'
                      : 'text-ink-2 hover:bg-surface-2',
                  )}
                >
                  {l.label}
                </Link>
              ))}

              <div className="my-2 h-px bg-line" role="separator" />

              {user ? (
                <>
                  <div className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
                    <Avatar src={user.avatar} name={user.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="truncate text-[11px] text-ink-3">{user.email}</p>
                    </div>
                    <Badge tone={isAdmin ? 'brand' : 'neutral'} className="shrink-0">
                      <Shield className="size-3" aria-hidden />
                      {user.role}
                    </Badge>
                  </div>
                  <DrawerLink href={`/users/${user.id}`} icon={<AtSign className="size-4" />} label={tc('publicProfile')} />
                  <DrawerLink href="/dashboard" icon={<LayoutDashboard className="size-4" />} label={t('dashboard')} />
                  <DrawerLink href="/dashboard/posts" icon={<PenSquare className="size-4" />} label={t('myPosts')} />
                  {isAdmin && <DrawerLink href="/admin" icon={<Shield className="size-4" />} label={t('admin')} />}
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10"
                  >
                    <LogOut className="size-4" aria-hidden /> {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong bg-surface text-sm font-semibold text-ink transition hover:border-brand-500 hover:text-brand-600"
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href="/register"
                    className="satin inline-flex h-10 items-center justify-center rounded-xl text-sm font-bold text-white shadow-brand"
                  >
                    {t('register')}
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="border-t border-line px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-4">
              <Layers className="size-3" aria-hidden /> {tc('tagline')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function DrawerLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink"
    >
      {icon} {label}
    </Link>
  );
}

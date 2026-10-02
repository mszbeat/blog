'use client';

/**
 * Site header — a thin brand + bell + account strip.
 *
 *   • Desktop: brand · primary nav · [bell] · [account menu].
 *   • Mobile : bell in one top corner, the menu button in the OPPOSITE corner,
 *     brand centred. The menu button opens the shared navigation drawer.
 *   • Settings is NOT here — it lives in the drawer (opened from the navbar's
 *     "more" or this menu button), keeping the bar calm and deduplicated.
 *   • Notifications exist ONLY here (the bell).
 *   • While the session probe is in flight we render a skeleton, never a Login
 *     button, so a signed-in user never sees a wrong state flash.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AtSign, ChevronDown, LayoutDashboard, LogOut, Menu,
  PenSquare, Shield, User as UserIcon,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDrawer } from '@/lib/drawer-context';
import { Avatar, Badge, Skeleton } from '@/components/ui/primitives';
import { BrandLogo } from '@/components/brand-logo';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const { user, isAdmin, isReady, logout } = useAuth();
  const { openDrawer } = useDrawer();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const links = [
    { href: '/', label: t('home') },
    { href: '/posts', label: t('blog') },
    { href: '/categories', label: t('categories') },
  ] as const;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Close the account menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const accountLinks = [
    { href: `/users/${user?.id}`, icon: AtSign, label: tc('publicProfile') },
    { href: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { href: '/dashboard/posts', icon: PenSquare, label: t('myPosts') },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-200',
        scrolled
          ? 'border-line bg-surface/85 shadow-sm shadow-black/[0.03] backdrop-blur-xl'
          : 'border-transparent bg-surface-2/60 backdrop-blur-sm',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        {/* Logo pinned to the corner of the page… */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-xl py-1 transition hover:opacity-90"
          aria-label={tc('appName')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/favicon.svg"
            alt=""
            width={34}
            height={34}
            className="size-[34px] shrink-0 rounded-[10px] shadow-sm shadow-brand-600/25 transition group-hover:scale-105"
          />
          <BrandLogo className="hidden sm:inline-flex" />
        </Link>

        {/* Desktop nav */}
        <nav className="mx-2 hidden items-center gap-1 md:flex" aria-label="main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive(l.href)
                  ? 'bg-brand-500/12 text-brand-700 dark:text-brand-300'
                  : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
              )}
              aria-current={isActive(l.href) ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          {/* The bell sits right beside the menu button (and beside the account
              menu on desktop) — one clustered action corner instead of icons
              scattered across both ends of the bar. */}
          <NotificationBell />
          {user ? (
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={cn(
                  'flex items-center gap-2 rounded-xl border border-line-strong bg-surface py-1 ps-1 pe-2.5',
                  'transition hover:border-brand-400',
                )}
              >
                <Avatar src={user.avatar} name={user.name} size="sm" />
                <span className="max-w-28 truncate text-sm font-semibold text-ink">{user.name}</span>
                <ChevronDown
                  className={cn('size-3.5 text-ink-3 transition-transform duration-200', menuOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute end-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/10 animate-fade-up"
                >
                  <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
                    <Avatar src={user.avatar} name={user.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-3">{user.email}</p>
                    </div>
                  </div>
                  <div className="px-2.5 pb-1.5">
                    <Badge tone={isAdmin ? 'brand' : 'neutral'}>
                      <Shield className="size-3" aria-hidden />
                      {user.role}
                    </Badge>
                  </div>

                  <div className="my-1 h-px bg-line" role="separator" />

                  {accountLinks.map((l) => (
                    <MenuLink key={l.href} href={l.href} icon={<l.icon className="size-4" />} label={l.label} />
                  ))}
                  {isAdmin && (
                    <MenuLink href="/admin" icon={<Shield className="size-4" />} label={t('admin')} />
                  )}

                  <div className="my-1 h-px bg-line" role="separator" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/10"
                  >
                    <LogOut className="size-4" aria-hidden />
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          ) : isReady ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-sm font-semibold text-ink-2 transition hover:bg-surface-3 hover:text-ink"
              >
                {t('login')}
              </Link>
              <Link
                href="/register"
                className="satin inline-flex h-9 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white shadow-brand transition active:scale-[0.985]"
              >
                {t('register')}
              </Link>
            </div>
          ) : (
            /* Session probe in flight — never flash a Login button. */
            <Skeleton className="hidden h-9 w-32 rounded-xl md:block" />
          )}

          {/* Mobile: the menu button, immediately after the bell. */}
          <button
            type="button"
            onClick={openDrawer}
            aria-label={t('menu')}
            className="inline-flex size-9 items-center justify-center rounded-xl border border-line-strong bg-surface-2 text-ink-2 transition hover:text-ink md:hidden"
          >
            <Menu className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
    >
      {icon}
      {label}
    </Link>
  );
}

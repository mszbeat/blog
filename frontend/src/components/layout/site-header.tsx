'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AtSign, BookOpen, ChevronDown, LayoutDashboard, LogOut, Menu, PenSquare,
  Settings, Shield, User as UserIcon, X,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
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

  // Close menus on navigation.
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [pathname]);

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

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-200',
        scrolled
          ? 'border-line bg-surface/85 shadow-sm shadow-black/[0.03] backdrop-blur-xl'
          : 'border-transparent bg-surface-2/60 backdrop-blur-sm',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-xl py-1 pe-2"
          aria-label={tc('appName')}
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm shadow-brand-600/25 transition group-hover:scale-105">
            <BookOpen className="size-[18px]" aria-hidden />
          </span>
          <span className="hidden text-base font-extrabold tracking-tight text-ink sm:block">
            {tc('appName')}
          </span>
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
                  ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                  : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
              )}
              aria-current={isActive(l.href) ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle className="hidden sm:inline-flex" />

          {isAuthenticated && user ? (
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

                  <MenuLink href={`/users/${user.id}`} icon={<UserIcon className="size-4" />} label={tc('publicProfile')} />
                  <MenuLink href="/dashboard" icon={<LayoutDashboard className="size-4" />} label={t('dashboard')} />
                  <MenuLink href="/dashboard/posts" icon={<PenSquare className="size-4" />} label={t('myPosts')} />
                  <MenuLink href="/dashboard/profile" icon={<Settings className="size-4" />} label={t('profile')} />
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
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className={cn(
                  'inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-sm font-semibold',
                  'text-ink-2 transition hover:bg-surface-3 hover:text-ink',
                )}
              >
                {t('login')}
              </Link>
              <Link
                href="/register"
                className={cn(
                  'inline-flex h-9 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold',
                  'text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.985]',
                )}
              >
                {t('register')}
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={t('menu')}
            className="inline-flex size-9 items-center justify-center rounded-xl border border-line-strong bg-surface-2 text-ink-2 transition hover:text-ink md:hidden"
          >
            {mobileOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-line bg-surface md:hidden animate-fade-in">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 p-4" aria-label="mobile">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-xl px-3.5 py-2.5 text-sm font-semibold transition',
                  isActive(l.href)
                    ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                    : 'text-ink-2 hover:bg-surface-2',
                )}
              >
                {l.label}
              </Link>
            ))}

            <div className="my-2 h-px bg-line" role="separator" />

            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-xs text-ink-3">{user.email}</p>
                  </div>
                  <Badge tone={isAdmin ? 'brand' : 'neutral'}>{user.role}</Badge>
                </div>
                <Link href="/dashboard" className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">
                  <LayoutDashboard className="size-4" aria-hidden /> {t('dashboard')}
                </Link>
                <Link href="/dashboard/posts" className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">
                  <PenSquare className="size-4" aria-hidden /> {t('myPosts')}
                </Link>
                <Link href={`/users/${user.id}`} className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">
                  <AtSign className="size-4" aria-hidden /> {tc('publicProfile')}
                </Link>
                <Link href="/dashboard/profile" className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">
                  <UserIcon className="size-4" aria-hidden /> {t('profile')}
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">
                    <Shield className="size-4" aria-hidden /> {t('admin')}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-500/10"
                >
                  <LogOut className="size-4" aria-hidden /> {t('logout')}
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong bg-surface text-sm font-semibold text-ink transition hover:border-brand-500 hover:text-brand-600"
                >
                  {t('login')}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
                >
                  {t('register')}
                </Link>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-2">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuLink({
  href, icon, label,
}: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
    >
      <span className="text-ink-3">{icon}</span>
      {label}
    </Link>
  );
}

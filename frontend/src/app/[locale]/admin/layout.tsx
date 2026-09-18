'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Layers, LayoutDashboard, Shield, Users } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/types';

/** Admin area — enforces the `admin` role, mirroring @Roles(UserRole.ADMIN). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAdmin>
      <Shell>{children}</Shell>
    </AuthGuard>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('users');
  const tcat = useTranslations('categories');
  const tn = useTranslations('nav');
  const td = useTranslations('dashboard');
  const locale = useLocale() as Locale;
  const pathname = usePathname();

  const links = [
    { href: '/admin', label: td('sections.admin'), icon: Shield, exact: true },
    { href: '/admin/users', label: t('title'), icon: Users },
    { href: '/admin/categories', label: tcat('title'), icon: Layers },
    { href: '/dashboard', label: tn('dashboard'), icon: LayoutDashboard },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-600/25">
            <Shield className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink">{tn('admin')}</h1>
            <p className="text-sm text-ink-3">
              {locale === 'fa' ? 'مدیریت کاربران، دسته‌بندی‌ها و محتوا' : 'Manage users, categories and content'}
            </p>
          </div>
        </div>
      </header>

      <div className="mt-7 grid gap-7 lg:grid-cols-[13rem_1fr]">
        <aside>
          <nav
            aria-label={locale === 'fa' ? 'منوی مدیریت' : 'Admin menu'}
            className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 lg:mx-0 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:px-0"
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
                    : 'text-ink-2 hover:bg-surface hover:text-ink',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

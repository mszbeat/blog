'use client';

import { useTranslations } from 'next-intl';
import { Github, Heart, Rss } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatNumber } from '@/lib/utils';
import { useLocale } from 'next-intl';
import type { Locale } from '@/lib/types';

export function SiteFooter() {
  const t = useTranslations('footer');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const locale = useLocale() as Locale;
  const { user, isReady } = useAuth();

  // Footer shows the real category list — cheap query, cached app-wide.
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
    staleTime: 5 * 60_000,
  });

  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand + description */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 transition hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/favicon.svg"
                alt=""
                width={34}
                height={34}
                className="size-[34px] rounded-[10px] shadow-sm shadow-brand-600/25"
              />
              <BrandLogo />
            </Link>
            <p className="mt-3.5 max-w-xs text-sm leading-relaxed text-ink-3">
              {t('description')}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <a
                href="https://github.com/mszbeat/blog"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-9 items-center justify-center rounded-xl border border-line-strong bg-surface-2 text-ink-3 transition hover:border-brand-400 hover:text-brand-600"
                aria-label="GitHub"
              >
                <Github className="size-4" aria-hidden />
              </a>
              <Link
                href="/posts"
                className="inline-flex size-9 items-center justify-center rounded-xl border border-line-strong bg-surface-2 text-ink-3 transition hover:border-brand-400 hover:text-brand-600"
                aria-label="RSS"
              >
                <Rss className="size-4" aria-hidden />
              </Link>
            </div>
          </div>

          {/* Quick links */}
          <nav aria-label={t('quickLinks')}>
            <h3 className="text-sm font-bold text-ink">{t('quickLinks')}</h3>
            <ul className="mt-3.5 space-y-2.5">
              {[
                { href: '/', label: tn('home') },
                { href: '/posts', label: tn('blog') },
                { href: '/categories', label: tn('categories') },
                /* Auth-specific tail. Held back until the session is known so a
                 * signed-in visitor is never offered "Login / Register" — the
                 * same rule the hero and rail CTAs follow. */
                ...(!isReady
                  ? []
                  : user
                    ? [
                        { href: '/dashboard', label: tn('dashboard') },
                        { href: '/dashboard/posts/new', label: tn('newPost') },
                      ]
                    : [
                        { href: '/login', label: tn('login') },
                        { href: '/register', label: tn('register') },
                      ]),
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-ink-3 transition hover:text-brand-600 dark:hover:text-brand-300"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Categories */}
          <nav aria-label={t('categories')}>
            <h3 className="text-sm font-bold text-ink">{t('categories')}</h3>
            <ul className="mt-3.5 space-y-2.5">
              {(categories ?? []).slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="group inline-flex items-center gap-1.5 text-sm text-ink-3 transition hover:text-brand-600 dark:hover:text-brand-300"
                  >
                    {c.name}
                    {typeof (c as { posts?: unknown[] }).posts?.length === 'number' && (
                      <span className="num-en text-xs text-ink-3/70">
                        ({formatNumber((c as { posts: unknown[] }).posts.length, locale)})
                      </span>
                    )}
                  </Link>
                </li>
              ))}
              {!categories?.length && (
                <li className="text-sm text-ink-3/60">{tc('noData')}</li>
              )}
            </ul>
          </nav>

          {/* The language column used to hold a switcher; language now lives in
              Settings (navbar), so the empty heading is gone rather than left
              as a dead column. */}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 sm:flex-row">
          {/* suppressHydrationWarning: the year is computed on both sides and can
              legitimately differ across the New Year boundary. */}
          <p className="num-en text-xs text-ink-3" suppressHydrationWarning>
            {t('rights', { year: formatNumber(year, locale), name: tc('appName') })}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-3">
            {t('builtWith')}
            <Heart className="size-3 text-rose-500" aria-hidden />
          </p>
        </div>
      </div>
    </footer>
  );
}

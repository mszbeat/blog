'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, Github, Heart, Rss } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { useLocale } from 'next-intl';
import type { Locale } from '@/lib/types';

export function SiteFooter() {
  const t = useTranslations('footer');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const locale = useLocale() as Locale;

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
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          {/* Brand + description */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm shadow-brand-600/25">
                <BookOpen className="size-[18px]" aria-hidden />
              </span>
              <span className="text-base font-extrabold tracking-tight text-ink">{tc('appName')}</span>
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
                { href: '/login', label: tn('login') },
                { href: '/register', label: tn('register') },
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

          {/* Language */}
          <div>
            <h3 className="text-sm font-bold text-ink">{t('language')}</h3>
            <div className="mt-3.5">
              <LocaleSwitcher />
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 sm:flex-row">
          <p className="num-en text-xs text-ink-3">
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

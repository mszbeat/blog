'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FileText, Layers, ShieldCheck, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useCategories, useMyStats, useUsers } from '@/lib/queries';
import { Card, Skeleton } from '@/components/ui/primitives';
import { formatNumber } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export default function AdminOverviewPage() {
  const locale = useLocale() as Locale;
  const tu = useTranslations('users');
  const tcat = useTranslations('categories');
  const td = useTranslations('dashboard');
  const tp = useTranslations('posts');

  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: myStats, isLoading: statsLoading } = useMyStats();

  const tiles = [
    {
      label: tu('totalUsers'),
      value: users?.length ?? 0,
      loading: usersLoading,
      icon: Users,
      href: '/admin/users',
      tone: 'from-brand-500 to-brand-700',
    },
    {
      label: tcat('title'),
      value: categories?.length ?? 0,
      loading: catsLoading,
      icon: Layers,
      href: '/admin/categories',
      tone: 'from-accent-500 to-teal-600',
    },
    {
      label: td('totalPosts'),
      value: myStats?.total ?? 0,
      loading: statsLoading,
      icon: FileText,
      href: '/dashboard/posts',
      tone: 'from-violet-500 to-purple-700',
    },
    {
      label: locale === 'fa' ? 'کل بازدید نوشته‌های من' : 'My posts’ views',
      value: myStats?.views ?? 0,
      loading: statsLoading,
      icon: ShieldCheck,
      href: '/dashboard',
      tone: 'from-amber-500 to-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ label, value, loading, icon: Icon, href, tone }) => (
          <Link key={label} href={href} className="group">
            <Card hover className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-3">{label}</p>
                  {loading ? (
                    <Skeleton className="mt-2 h-8 w-14" />
                  ) : (
                    <p className="num-en mt-1.5 text-3xl font-extrabold tracking-tight text-ink">
                      {formatNumber(value, locale)}
                    </p>
                  )}
                </div>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${tone}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-ink">{tcat('title')}</h2>
          <p className="mt-1 text-xs text-ink-3">{tcat('adminOnly')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {catsLoading ? (
              <Skeleton className="h-7 w-full" />
            ) : (categories ?? []).length === 0 ? (
              <p className="text-sm text-ink-3">{tcat('noCategories')}</p>
            ) : (
              (categories ?? []).map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs font-semibold text-ink-2"
                >
                  {c.name}
                </span>
              ))
            )}
          </div>
          <Link
            href="/admin/categories"
            className="mt-4 inline-flex text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            {tcat('editCategory')} →
          </Link>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-ink">{tp('myPosts')}</h2>
          <p className="mt-1 text-xs text-ink-3">{td('welcomeSub')}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              { k: td('publishedPosts'), v: myStats?.published ?? 0 },
              { k: td('draftPosts'), v: myStats?.drafts ?? 0 },
              { k: td('totalViews'), v: myStats?.views ?? 0 },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-xl bg-surface-2 p-3">
                <dt className="truncate text-[11px] font-medium text-ink-3">{k}</dt>
                <dd className="num-en mt-1 text-lg font-extrabold text-ink">
                  {statsLoading ? '—' : formatNumber(v, locale)}
                </dd>
              </div>
            ))}
          </dl>
          <Link
            href="/dashboard/posts"
            className="mt-4 inline-flex text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300"
          >
            {tp('allPosts')} →
          </Link>
        </Card>
      </div>
    </div>
  );
}

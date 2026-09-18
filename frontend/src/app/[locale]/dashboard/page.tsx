'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Eye, FileText, FilePlus2, FileX2, Layers, PenSquare, Settings, Shield, Users,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMyStats } from '@/lib/queries';
import { PostRow } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/primitives';
import { formatNumber } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export default function DashboardOverviewPage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('dashboard');
  const tn = useTranslations('nav');
  const tu = useTranslations('users');
  const tc = useTranslations('common');
  const { user, isAdmin } = useAuth();

  const { data: stats, isLoading, isError, refetch } = useMyStats();

  const cards = [
    { label: t('totalPosts'), value: stats?.total ?? 0, icon: FileText, tone: 'text-brand-600 bg-brand-500/10' },
    { label: t('publishedPosts'), value: stats?.published ?? 0, icon: FilePlus2, tone: 'text-emerald-600 bg-emerald-500/10' },
    { label: t('draftPosts'), value: stats?.drafts ?? 0, icon: FileX2, tone: 'text-amber-600 bg-amber-500/10' },
    { label: t('totalViews'), value: stats?.views ?? 0, icon: Eye, tone: 'text-sky-600 bg-sky-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <section aria-label={t('overview')}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, tone }) => (
            <Card key={label} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-3">{label}</p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-8 w-16" />
                  ) : (
                    <p className="num-en mt-1.5 text-3xl font-extrabold tracking-tight text-ink">
                      {formatNumber(value, locale)}
                    </p>
                  )}
                </div>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="size-5" aria-hidden />
                </span>
              </div>
            </Card>
          ))}
        </div>

        {isError && (
          <p className="mt-3 text-sm text-rose-600">
            {tc('error')} —{' '}
            <button type="button" onClick={() => void refetch()} className="font-semibold underline">
              {tc('retry')}
            </button>
          </p>
        )}
      </section>

      {/* ── Quick actions ── */}
      <Card>
        <CardHeader title={t('quickActions')} icon={<PenSquare className="size-[18px]" aria-hidden />} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/dashboard/posts/new" icon={FilePlus2} label={t('writeNewPost')} primary />
          <QuickAction href="/dashboard/posts" icon={FileText} label={tn('myPosts')} />
          <QuickAction href="/dashboard/profile" icon={Settings} label={t('manageProfile')} />
          {isAdmin && <QuickAction href="/admin/users" icon={Users} label={t('manageUsers')} />}
          {isAdmin && <QuickAction href="/admin/categories" icon={Layers} label={t('manageCategories')} />}
          {isAdmin && <QuickAction href="/admin" icon={Shield} label={tn('admin')} />}
        </div>
      </Card>

      {/* ── Recent posts ── */}
      <Card>
        <CardHeader
          title={t('recentPosts')}
          icon={<FileText className="size-[18px]" aria-hidden />}
          action={
            <Link href="/dashboard/posts" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
              {tc('viewAll')}
            </Link>
          }
        />

        {isLoading ? (
          <div className="space-y-1 p-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : !stats?.recent.length ? (
          <EmptyState
            icon={<FileText className="size-6" aria-hidden />}
            title={t('noRecentPosts')}
            action={
              <Link href="/dashboard/posts/new">
                <Button size="sm">{t('writeNewPost')}</Button>
              </Link>
            }
          />
        ) : (
          <div className="p-2">
            {stats.recent.map((post) => (
              <PostRow key={post.id} post={post} locale={locale} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Account summary ── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{user?.name}</p>
            <p className="num-en mt-0.5 truncate text-xs text-ink-3" dir="ltr">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold text-ink-2">
              {tu(`role${(user?.role ?? 'user').charAt(0).toUpperCase()}${(user?.role ?? 'user').slice(1)}` as 'roleAdmin')}
            </span>
            <Link href="/dashboard/profile">
              <Button variant="secondary" size="sm">{t('manageProfile')}</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

function QuickAction({
  href, icon: Icon, label, primary = false,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'group flex items-center gap-3 rounded-xl bg-brand-600 p-3.5 text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99]'
          : 'group flex items-center gap-3 rounded-xl border border-line-strong bg-surface p-3.5 transition hover:border-brand-400 hover:bg-surface-2 active:scale-[0.99]'
      }
    >
      <span
        className={
          primary
            ? 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15'
            : 'flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-3 transition group-hover:text-brand-600'
        }
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className={`min-w-0 truncate text-sm font-semibold ${primary ? 'text-white' : 'text-ink'}`}>
        {label}
      </span>
    </Link>
  );
}

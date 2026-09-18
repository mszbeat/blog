'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarDays, FileText, Grid3x3, Info, Layers, Mail, ShieldCheck,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { PostsGrid } from '@/components/profile/posts-grid';
import { FeedItem } from '@/components/feed/feed-item';
import { Badge } from '@/components/ui/primitives';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import type { Locale, Post, User } from '@/lib/types';

type Tab = 'grid' | 'feed' | 'about';

/**
 * Tabbed body of the profile page.
 *  • grid  — Instagram-style squares
 *  • feed  — the same cards as the home feed (easier to actually read)
 *  • about — bio + account facts
 */
export function ProfileTabs({
  user, posts, isSelf,
}: {
  user: User;
  posts: Post[];
  isSelf: boolean;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations('profile');
  const tp = useTranslations('posts');
  const tc = useTranslations('common');
  const tu = useTranslations('users');
  const tcat = useTranslations('categories');

  const [tab, setTab] = useState<Tab>('grid');

  const published = posts.filter((p) => p.published);
  const drafts = posts.filter((p) => !p.published);

  // Which categories does this person actually write in?
  const catCount = new Map<string, number>();
  posts.forEach((p) =>
    (p.categories ?? []).forEach((c) => catCount.set(c.name, (catCount.get(c.name) ?? 0) + 1)),
  );
  const topCats = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const roleKey = `role${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` as
    | 'roleAdmin' | 'roleUser' | 'roleGuest';

  const TABS: { id: Tab; label: string; icon: typeof Grid3x3; count?: number }[] = [
    { id: 'grid', label: tp('allPosts'), icon: Grid3x3, count: published.length },
    { id: 'feed', label: t('feedView'), icon: FileText },
    { id: 'about', label: t('about'), icon: Info },
  ];

  // Drafts are a separate toggle rather than a 4th tab: they only exist for
  // the author, so a fixed three-tab bar keeps the layout stable for visitors.
  const [showDrafts, setShowDrafts] = useState(false);

  const visible = showDrafts ? drafts : tab === 'feed' ? posts : published;

  return (
    <div>
      {/* ── Tab bar ── */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-surface-2/85 px-4 backdrop-blur-xl sm:mx-0 sm:rounded-t-2xl sm:border sm:border-b-0">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setShowDrafts(false); }}
              aria-current={tab === id && !showDrafts}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-bold transition',
                tab === id && !showDrafts ? 'text-brand-600 dark:text-brand-300' : 'text-ink-3 hover:text-ink',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {typeof count === 'number' && count > 0 && (
                <span className="num-en rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-2">
                  {formatNumber(count, locale)}
                </span>
              )}
              {tab === id && !showDrafts && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
              )}
            </button>
          ))}

          {isSelf && drafts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDrafts((v) => !v)}
              aria-pressed={showDrafts}
              className={cn(
                'relative inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-bold transition',
                showDrafts ? 'text-amber-600' : 'text-ink-3 hover:text-ink',
              )}
            >
              <FileText className="size-4" aria-hidden />
              {tp('draft')}
              <span className="num-en rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-400">
                {formatNumber(drafts.length, locale)}
              </span>
              {showDrafts && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-amber-500" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Panel ── */}
      <div className="pt-5">
        {tab === 'about' && !showDrafts ? (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            {/* Bio */}
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                <Info className="size-4 text-brand-500" aria-hidden />
                {tc('bio')}
              </h2>
              {user.bio ? (
                <p className="mt-3 text-sm leading-loose whitespace-pre-wrap text-ink-2">{user.bio}</p>
              ) : (
                <p className="mt-3 text-sm text-ink-3">
                  {t('noBio')}
                </p>
              )}

              {topCats.length > 0 && (
                <>
                  <h3 className="mt-6 flex items-center gap-2 text-sm font-bold text-ink">
                    <Layers className="size-4 text-accent-500" aria-hidden />
                    {t('writesAbout')}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topCats.map(([name, count]) => (
                      <span key={name} className="chip !cursor-default">
                        {name}
                        <span className="num-en text-[10px] opacity-70">{formatNumber(count, locale)}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* Facts */}
            <section className="card divide-y divide-line">
              <Fact icon={<ShieldCheck className="size-4" aria-hidden />} label={tc('role')} value={tu(roleKey)} />
              <Fact
                icon={<CalendarDays className="size-4" aria-hidden />}
                label={t('memberSince', { date: '' }).replace(/\s+$/, '')}
                value={formatDate(user.createdAt, locale, { year: 'numeric', month: 'long', day: 'numeric' })}
              />
              <Fact
                icon={<FileText className="size-4" aria-hidden />}
                label={tp('allPosts')}
                value={formatNumber(published.length, locale)}
              />
              <Fact
                icon={<Layers className="size-4" aria-hidden />}
                label={tcat('title')}
                value={formatNumber(topCats.length, locale)}
              />
              {isSelf && (
                <Fact
                  icon={<Mail className="size-4" aria-hidden />}
                  label={tc('email')}
                  value={user.email}
                  ltr
                />
              )}
            </section>
          </div>
        ) : tab === 'feed' && !showDrafts ? (
          <div className="mx-auto max-w-2xl space-y-4">
            {visible.length === 0 ? (
              <div className="card py-16 text-center">
                <p className="text-sm text-ink-3">{tp('noPosts')}</p>
              </div>
            ) : (
              visible.map((post) => <FeedItem key={post.id} post={post} locale={locale} />)
            )}
          </div>
        ) : (
          <PostsGrid posts={visible} />
        )}
      </div>
    </div>
  );
}

function Fact({
  icon, label, value, ltr,
}: { icon: React.ReactNode; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink-3">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</span>
        <span
          className={cn('mt-0.5 block truncate text-sm font-semibold text-ink', ltr && 'num-en')}
          dir={ltr ? 'ltr' : undefined}
        >
          {value}
        </span>
      </span>
      <Badge tone="neutral" className="!px-2 !py-0.5 !text-[10px]">·</Badge>
    </div>
  );
}

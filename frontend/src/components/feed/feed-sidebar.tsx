import { useTranslations } from 'next-intl';
import {
  FileText, Flame, Layers, PenSquare, TrendingUp, Users,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Avatar, Badge } from '@/components/ui/primitives';
import { cn, formatNumber } from '@/lib/utils';
import type { Category, Locale, Post, User } from '@/lib/types';

/**
 * Sticky right-hand rail (left in RTL) — the LinkedIn/Instagram pattern:
 * categories, most-read posts and active authors, all derived from data the
 * page already fetched so no extra API round trips are made.
 */
export function FeedSidebar({
  categories, posts, locale, currentCategory = null,
}: {
  categories: Category[];
  posts: Post[];
  locale: Locale;
  currentCategory?: string | null;
}) {
  const t = useTranslations('categories');
  const tp = useTranslations('posts');
  const tc = useTranslations('common');
  const th = useTranslations('home');
  const ts = useTranslations('sidebar');

  // Most-read across the posts we already have.
  const trending = [...posts]
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .slice(0, 4);

  // Aggregate authors from the loaded posts (the API has no public user list).
  const authorMap = new Map<string, { user: User; count: number; views: number }>();
  posts.forEach((p) => {
    if (!p.author) return;
    const prev = authorMap.get(p.author.id) ?? { user: p.author, count: 0, views: 0 };
    prev.count += 1;
    prev.views += p.viewCount ?? 0;
    authorMap.set(p.author.id, prev);
  });
  const authors = [...authorMap.values()].sort((a, b) => b.views - a.views).slice(0, 4);

  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-24 space-y-4">
        {/* ── Categories ── */}
        <section className="card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Layers className="size-4 text-brand-500" aria-hidden />
            <h2 className="text-sm font-bold text-ink">{t('title')}</h2>
          </header>

          {categories.length === 0 ? (
            <p className="px-4 py-5 text-sm text-ink-3">{t('noCategories')}</p>
          ) : (
            <nav className="p-2" aria-label={t('title')}>
              <Link
                href="/posts"
                className={cn(
                  'flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition',
                  !currentCategory
                    ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                <span>{t('allCategories')}</span>
                <span className="num-en text-xs text-ink-3">{formatNumber(posts.length, locale)}</span>
              </Link>

              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/posts?category=${encodeURIComponent(c.slug)}`}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition',
                    currentCategory === c.slug
                      ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  {typeof c.posts?.length === 'number' && c.posts.length > 0 && (
                    <span className="num-en text-xs text-ink-3">{formatNumber(c.posts.length, locale)}</span>
                  )}
                </Link>
              ))}
            </nav>
          )}
        </section>

        {/* ── Trending ── */}
        {trending.length > 0 && (
          <section className="card overflow-hidden">
            <header className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Flame className="size-4 text-orange-500" aria-hidden />
              <h2 className="text-sm font-bold text-ink">
                {ts('mostRead')}
              </h2>
            </header>

            <ol className="p-2">
              {trending.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/posts/${p.slug}`}
                    className="group flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-surface-2"
                  >
                    <span className="num-en mt-0.5 w-4 shrink-0 text-sm font-extrabold text-ink-4">
                      {formatNumber(i + 1, locale)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-ink transition group-hover:text-brand-600 dark:group-hover:text-brand-300">
                        {p.title}
                      </span>
                      <span className="num-en mt-0.5 flex items-center gap-1 text-[11px] text-ink-3">
                        <TrendingUp className="size-3" aria-hidden />
                        {formatNumber(p.viewCount ?? 0, locale)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Authors ── */}
        {authors.length > 0 && (
          <section className="card overflow-hidden">
            <header className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Users className="size-4 text-accent-500" aria-hidden />
              <h2 className="text-sm font-bold text-ink">
                {ts('activeWriters')}
              </h2>
            </header>

            <div className="p-2">
              {authors.map(({ user, count }) => (
                <Link
                  key={user.id}
                  href={`/users/${user.id}`}
                  className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-surface-2"
                >
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink transition group-hover:text-brand-600 dark:group-hover:text-brand-300">
                      {user.name}
                    </span>
                    <span className="num-en block truncate text-[11px] text-ink-3">
                      {tp('allPosts')}: {formatNumber(count, locale)}
                    </span>
                  </span>
                  {user.role === 'admin' && <Badge tone="brand" className="!px-1.5 !py-0 !text-[10px]">★</Badge>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Write CTA ── */}
        <Link
          href="/dashboard/posts/new"
          className="card card-hover flex items-center gap-3 p-4 !border-dashed"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <PenSquare className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">{th('heroSecondary')}</span>
            <span className="block text-xs text-ink-3">
              {ts('publishFirst')}
            </span>
          </span>
        </Link>

        <p className="num-en flex items-center justify-center gap-1.5 px-4 pb-2 text-[11px] text-ink-4">
          <FileText className="size-3" aria-hidden />
          {tc('appName')} · {formatNumber(posts.length, locale)} {th('stats.posts')}
        </p>
      </div>
    </aside>
  );
}

/** Narrow-skeleton version so the layout doesn't jump before hydration. */
export function FeedSidebarSkeleton() {
  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-24 space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="card p-4">
            <div className="skeleton mb-3 h-4 w-24" />
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, j) => <div key={j} className="skeleton h-3.5 w-full" />)}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

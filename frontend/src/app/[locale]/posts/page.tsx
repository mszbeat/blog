import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Filter, Rss, SlidersHorizontal } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { FeedItem } from '@/components/feed/feed-item';
import { FeedSidebar } from '@/components/feed/feed-sidebar';
import { PostsClient } from '@/components/post/posts-client';
import { getPostsCached, getCategoriesCached } from '@/lib/server-api';
import { buildQuery, formatNumber, parsePagination } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string; category?: string; limit?: string;
  }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { category } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'posts' });
  const tc = await getTranslations({ locale, namespace: 'categories' });
  return {
    title: category ? `${tc('title')}: ${category}` : t('pageTitle'),
    description: t('noPostsDesc'),
    alternates: { canonical: `/${locale}/posts${category ? `?category=${category}` : ''}` },
  };
}

export default async function PostsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const t = await getTranslations('posts');
  const tc = await getTranslations('categories');

  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(48, Math.max(4, Number(sp.limit) || 12));
  const category = sp.category?.trim() || null;

  const [postsRes, catsRes] = await Promise.allSettled([
    getPostsCached({ page, limit, published: true, category: category ?? undefined }),
    getCategoriesCached(),
  ]);

  const postsResult = postsRes.status === 'fulfilled' ? postsRes.value : null;
  const posts = postsResult?.data ?? [];
  const pagination = parsePagination(postsResult?.meta, loc);
  const categories = catsRes.status === 'fulfilled' ? (catsRes.value ?? []) : [];
  const apiDown = postsRes.status === 'rejected';

  const activeCategory = categories.find((c) => c.slug === category) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* ── Page heading ── */}
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="chip !border-brand-500/25 !bg-brand-500/8 !text-brand-700 dark:!text-brand-300">
            <Rss className="size-3.5" aria-hidden />
            {t('publicFeed')}
          </span>
          {activeCategory && (
            <span className="chip !border-accent-500/25 !bg-accent-500/8 !text-accent-700 dark:!text-accent-300">
              <Filter className="size-3.5" aria-hidden />
              {activeCategory.name}
            </span>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {activeCategory ? activeCategory.name : t('pageTitle')}
        </h1>

        <p className="mt-1.5 text-sm text-ink-3">
          {pagination.totalItems != null
            ? t('publishedCount', { count: formatNumber(pagination.totalItems, loc) })
            : t('feedOrder')}
        </p>
      </header>

      {/* ── Category filter chips ── */}
      {categories.length > 0 && (
        <nav
          aria-label={tc('title')}
          className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          <Link
            href={`/posts${buildQuery({ limit: String(limit) })}`}
            aria-current={!category}
            className={`chip shrink-0 ${!category ? 'chip-active' : ''}`}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {tc('allCategories')}
          </Link>

          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/posts${buildQuery({ category: c.slug, limit: String(limit) })}`}
              aria-current={category === c.slug}
              className={`chip shrink-0 ${category === c.slug ? 'chip-active' : ''}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {/* ── Feed + rail ── */}
      <div className="flex items-start gap-8">
        <main className="min-w-0 flex-1">
          {apiDown ? (
            <div className="card px-6 py-16 text-center">
              <p className="text-sm font-semibold text-ink">
                {t('apiDown')}
              </p>
              <p className="mt-1.5 text-xs text-ink-3">
                {t('apiDownHint')}
              </p>
            </div>
          ) : posts.length === 0 ? (
            <div className="card px-6 py-20 text-center">
              <p className="text-base font-bold text-ink">{t('noPosts')}</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-3">{t('noPostsDesc')}</p>
              {category && (
                <Link href="/posts" className="chip mt-5 inline-flex">
                  {tc('allCategories')}
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-5">
                {posts.map((post) => <FeedItem key={post.id} post={post} locale={loc} />)}
              </div>

              {/* Pagination — kept client-side so filters stay in the URL */}
              <PostsClient
                pagination={pagination}
                category={category}
                limit={limit}
                locale={loc}
              />
            </>
          )}
        </main>

        <FeedSidebar
          categories={categories}
          posts={posts}
          locale={loc}
          currentCategory={category}
        />
      </div>
    </div>
  );
}

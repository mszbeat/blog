import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Layers, SearchX } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getCategoryBySlug, getPosts, ServerApiError } from '@/lib/server-api';
import { PostCard } from '@/components/post-card';
import { ApiDownNotice } from '@/components/api-down-notice';
import { Card, EmptyState } from '@/components/ui/primitives';
import { cn, gradientFor } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const category = await getCategoryBySlug(decodeURIComponent(slug));
    return { title: category.name, description: category.description ?? undefined };
  } catch {
    return {};
  }
}

export default async function CategoryDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;
  const rtl = loc === 'fa';
  const decoded = decodeURIComponent(slug);

  const t = await getTranslations('categories');
  const tp = await getTranslations('posts');
  const tcat = await getTranslations('categories');

  let category;
  try {
    category = await getCategoryBySlug(decoded);
  } catch (e) {
    if (e instanceof ServerApiError && e.status === 404) notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <ApiDownNotice />
      </div>
    );
  }

  // GET /categories/:slug returns `posts` but without the author join, so we
  // read the list through /post?category= to get fully-populated cards.
  let posts: Awaited<ReturnType<typeof getPosts>>['data'] = [];
  let postsFailed = false;
  try {
    const res = await getPosts({ category: category.slug, limit: 24, published: true });
    posts = res.data ?? [];
  } catch {
    postsFailed = true;
    posts = (category.posts ?? []) as typeof posts;
  }

  return (
    <div className="pb-16">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-line bg-surface">
        <div
          aria-hidden
          className={cn('absolute inset-0 opacity-[0.07]', gradientFor(category.slug))}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <span className={cn('inline-flex size-12 items-center justify-center rounded-2xl text-white shadow-lg', gradientFor(category.slug))}>
            <Layers className="size-6" aria-hidden />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-2">
              {category.description}
            </p>
          )}
          <p className="num-en mt-4 text-sm text-ink-3">
            {tcat('postsCount', { count: posts.length })}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <Link
          href="/categories"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-300"
        >
          <ArrowRight className={cn('size-4', !rtl && 'rotate-180')} aria-hidden />
          {t('allCategories')}
        </Link>

        {postsFailed && <div className="mt-6"><ApiDownNotice /></div>}

        {posts.length === 0 ? (
          <Card className="mt-6">
            <EmptyState
              icon={<SearchX className="size-6" aria-hidden />}
              title={tp('noPosts')}
              description={tp('noPostsDesc')}
              action={
                <Link
                  href="/posts"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
                >
                  {tp('allPosts')}
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} locale={loc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

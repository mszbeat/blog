import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import {
  Flame, Layers, Sparkles, TrendingUp, UserPlus,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { FeedItem } from '@/components/feed/feed-item';
import { FeedSidebar } from '@/components/feed/feed-sidebar';
import { WhenSignedOut } from '@/components/auth-gate';
import { getPostsCached, getCategoriesCached } from '@/lib/server-api';
import { formatNumber } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  const tseo = await getTranslations({ locale, namespace: 'seo' });
  return {
    title: tseo('home.title'),
    description: tseo('home.description'),
    alternates: { canonical: `/${locale}` },
    openGraph: { title: tseo('home.title'), description: tseo('home.description'), type: 'website' },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const t = await getTranslations('home');
  const tc = await getTranslations('common');
  const tp = await getTranslations('posts');
  const tcat = await getTranslations('categories');

  const [postsRes, catsRes] = await Promise.allSettled([
    getPostsCached({ page: 1, limit: 24, published: true }),
    getCategoriesCached(),
  ]);

  const posts = postsRes.status === 'fulfilled' ? (postsRes.value.data ?? []) : [];
  const categories = catsRes.status === 'fulfilled' ? (catsRes.value ?? []) : [];
  const apiDown = postsRes.status === 'rejected';

  const [featured, ...rest] = posts;
  const totalViews = posts.reduce((s, p) => s + (p.viewCount ?? 0), 0);

  return (
    <div className="pb-16">
      {/* ═══════════════════ Hero ═══════════════════ */}
      <section className="relative overflow-hidden border-b border-line bg-surface-2">
        {/* Triadic mesh (iris / plum / apricot) over a faint grid — the grid
            keeps it structured, the mesh keeps it from reading as flat grey. */}
        <div className="bg-mesh absolute inset-0" aria-hidden />
        <div className="bg-grid absolute inset-0 opacity-45" aria-hidden />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-28 h-80 w-80 rounded-full bg-brand-500/14 blur-3xl"
          style={{ insetInlineStart: '-3rem' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 h-80 w-80 rounded-full bg-plum-500/12 blur-3xl"
          style={{ insetInlineEnd: '-2rem' }}
        />

        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Copy */}
            <div>
              <span className="chip !border-brand-500/25 !bg-brand-500/8 !text-brand-700 dark:!text-brand-300">
                <Sparkles className="size-3.5" aria-hidden />
                {tc('appName')}
              </span>

              <h1 className="mt-4 text-[2rem] font-extrabold leading-[1.15] tracking-tight text-balance text-ink sm:text-5xl">
                {t('heroTitle')}
              </h1>
              {/* Thin triadic rule under the headline — picks up the mesh hues. */}
              <div
                aria-hidden
                className="mt-5 h-1 w-24 rounded-full bg-gradient-to-r from-brand-500 via-plum-500 to-accent-500"
              />

              <p className="mt-4 max-w-xl text-[15px] leading-loose text-pretty text-ink-2 sm:text-base">
                {t('heroSubtitle')}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Link href="/posts" className="contents">
                  <Button variant="primary" size="lg" className="shadow-brand">{t('heroCta')}</Button>
                </Link>
                {/* "Join us" is a guest affordance — members never see it. */}
                <WhenSignedOut>
                  <Link href="/register" className="contents">
                    <Button variant="outline" size="lg" className="gap-2">
                      <UserPlus className="size-4" aria-hidden />
                      {t('heroSecondary')}
                    </Button>
                  </Link>
                </WhenSignedOut>
              </div>

              <dl className="num-en mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
                {[
                  { label: t('stats.posts'), value: formatNumber(posts.length, loc) },
                  { label: t('stats.categories'), value: formatNumber(categories.length, loc) },
                  { label: t('stats.views'), value: formatNumber(totalViews, loc) },
                ].map((s) => (
                  <div key={s.label} className="min-w-[5.5rem]">
                    <dt className="order-2 text-xs font-medium text-ink-3">{s.label}</dt>
                    <dd className="order-1 text-2xl font-extrabold tracking-tight text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Featured card — desktop only, keeps the hero from feeling empty */}
            {featured && (
              <div className="hidden lg:block">
                <Badge tone="brand" className="mb-2.5 !text-[11px]">
                  <Flame className="size-3" aria-hidden />
                  {t('featuredBadge')}
                </Badge>
                <FeedItem post={featured} locale={loc} variant="compact" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════ Feed + sidebar ═══════════════════ */}
      <div className="mx-auto max-w-[66rem] px-4 sm:px-6">
        <div className="mt-10 flex items-start justify-center gap-8">
          {/* Main column — capped to the same 36rem measure as /posts so the
              two feeds read identically instead of one being much wider. */}
          <main className="min-w-0 flex-1 max-w-[36rem]">
            {/* Section heading */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink sm:text-xl">
                  <TrendingUp className="size-5 text-brand-500" aria-hidden />
                  {t('feedTitle')}
                </h2>
                <p className="mt-1 text-sm text-ink-3">
                  {t('feedDesc')}
                </p>
              </div>
              <Link href="/posts" className="contents">
                <Button variant="outline" size="sm">{tp('allPosts')}</Button>
              </Link>
            </div>

            {apiDown ? (
              <EmptyState
                title={tc('retry')}
                description={tp('apiDownHint')}
                action={<Link href="/" className="contents"><Button variant="outline">{tc('retry')}</Button></Link>}
              />
            ) : posts.length === 0 ? (
              <EmptyState
                title={tp('noPosts')}
                description={tp('noPostsDesc')}
                action={<Link href="/dashboard/posts/new" className="contents"><Button variant="primary">{tp('newPost')}</Button></Link>}
              />
            ) : (
              <div className="space-y-5">
                {/* On mobile the featured post leads the feed instead of the hero */}
                {featured && (
                  <div className="lg:hidden">
                    <FeedItem post={featured} locale={loc} />
                  </div>
                )}
                {(featured ? rest : posts).map((post) => (
                  <FeedItem key={post.id} post={post} locale={loc} />
                ))}
              </div>
            )}

            {/* Mobile category strip — the sidebar is hidden below lg */}
            {categories.length > 0 && (
              <section className="mt-8 lg:hidden">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                  <Layers className="size-4 text-brand-500" aria-hidden />
                  {tcat('title')}
                </h2>
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/posts?category=${encodeURIComponent(c.slug)}`}
                      className="chip shrink-0 !py-2"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </main>

          {/* Rail */}
          <FeedSidebar categories={categories} posts={posts} locale={loc} />
        </div>
      </div>
    </div>
  );
}

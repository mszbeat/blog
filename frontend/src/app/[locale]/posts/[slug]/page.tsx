// import { BackButton } from '@/components/back-button';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CalendarDays, Clock, Eye, Tag } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getPostBySlug, ServerApiError } from '@/lib/server-api';
import { ExpandablePostBody } from '@/components/post/expandable-body';
import { PostActionRail } from '@/components/post/post-action-rail';
import { ImageCarousel } from '@/components/post/image-carousel';
import { AboutAuthor } from '@/components/post/about-author';
import { CommentsSection } from '@/components/comments-section';
import { ApiDownNotice } from '@/components/api-down-notice';
import { Avatar, Badge } from '@/components/ui/primitives';
import {
  cn, formatDate, formatNumber, gradientFor, readingMinutes, resolveMedia, truncate,
} from '@/lib/utils';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const post = await getPostBySlug(decodeURIComponent(slug));
    return {
      title: post.title,
      description: truncate(post.excerpt || post.content, 160),
      openGraph: {
        title: post.title,
        description: truncate(post.excerpt || post.content, 160),
        type: 'article',
        publishedTime: post.createdAt,
        modifiedTime: post.updatedAt,
        authors: post.author ? [post.author.name] : undefined,
        images: resolveMedia(post.coverImage) ? [{ url: resolveMedia(post.coverImage)! }] : undefined,
      },
    };
  } catch {
    const t = await getTranslations({ locale, namespace: 'posts' });
    return { title: t('allPosts') };
  }
}

export default async function PostDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  const loc = locale as Locale;

  const t = await getTranslations('posts');
  const tc = await getTranslations('common');

  let post;
  let apiDown = false;
  try {
    post = await getPostBySlug(decodeURIComponent(slug));
  } catch (e) {
    // 404 → real not-found page; anything else → show the connectivity notice.
    if (e instanceof ServerApiError && e.status === 404) notFound();
    apiDown = true;
  }

  if (apiDown || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <ApiDownNotice />
        {/* <BackButton /> */}
      </div>
    );
  }

  const cover = resolveMedia(post.coverImage);
  /* Gallery (upload order) drives the slideshow; the first slide doubles as the
     ambient blurred backdrop and as the card/OG thumbnail fallback. */
  const gallery = (post.images ?? []).map((u) => resolveMedia(u)).filter((u): u is string => !!u);
  const heroSrc = gallery[0] ?? cover;
  const mins = readingMinutes(post.content ?? '');
  const author = post.author;

  return (
    <article className="pb-16">
      {/* ── Sticky "back to the site" ──
          Pinned to the top corner so it stays one tap away while reading. It
          used to sit at the BOTTOM of the rail, under the author card, where
          nobody ever found it. */}
      {/* <div className="sticky top-20 z-30 mx-auto max-w-[68rem] px-4 pb-3 sm:px-6">
        <BackButton />
      </div> */}
      {/* ══════════ Hero ══════════
       * The cover appears twice on purpose: a scaled, heavily blurred copy
       * fills the band edge-to-edge as an ambient backdrop, and the sharp
       * original floats centred on top of it. Same URL, so the browser fetches
       * the asset once — the blur is pure CSS and costs nothing extra. */}
      <header className="relative isolate overflow-hidden border-b border-line bg-surface">
        {heroSrc ? (
          <>
            <div aria-hidden className="absolute inset-0 -z-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroSrc}
                alt=""
                className="size-full scale-125 object-cover opacity-55 blur-3xl saturate-150"
              />
              {/* Veil keeps the title legible over a busy photograph. */}
              <div className="absolute inset-0 bg-surface/45 dark:bg-surface-2/70" />
            </div>

            <div className="relative mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-10">
              {gallery.length > 0 ? (
                /* Multi-image posts read as a swipeable slideshow, Instagram-style. */
                <ImageCarousel images={gallery} alt={post.title} className="mx-auto max-w-3xl shadow-elev-3" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={heroSrc}
                  alt=""
                  fetchPriority="high"
                  className="mx-auto max-h-[22rem] w-auto rounded-2xl object-contain shadow-elev-3 ring-1 ring-black/5 dark:ring-white/10 sm:max-h-[27rem]"
                />
              )}
            </div>
          </>
        ) : (
          <div
            aria-hidden
            className={cn('h-40 w-full sm:h-52', gradientFor(post.slug))}
          />
        )}

        <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-6 sm:px-6">
          {post.categories && post.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.categories.map((c) => (
                <Link key={c.id} href={`/categories/${c.slug}`}>
                  <Badge tone="brand" className="bg-surface/90 shadow-sm ring-line backdrop-blur">
                    <Tag className="size-3" aria-hidden />
                    {c.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.2]">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mt-4 text-base leading-relaxed text-ink-2 sm:text-lg">
              {post.excerpt}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-5 text-sm text-ink-3">
            {author && (
              /* Avatar and name both link through to the public profile. */
              <Link href={`/users/${author.id}`} className="group flex items-center gap-2.5">
                <Avatar
                    src={author.avatar}
                    name={author.name}
                    size="sm"
                    className="transition group-hover:scale-105"
                  />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink transition group-hover:text-brand-600 dark:group-hover:text-brand-300">
                    {author.name}
                  </span>
                  {author.bio && (
                    <span className="block max-w-56 truncate text-xs text-ink-3">{author.bio}</span>
                  )}
                </span>
              </Link>
            )}

            <span className="num-en inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              {t('publishedOn', {
                date: formatDate(post.createdAt, loc, { year: 'numeric', month: 'long', day: 'numeric' }),
              })}
            </span>

            <span className="num-en inline-flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden />
              {formatNumber(mins, loc)} {tc('minRead')}
            </span>

            <span className="num-en inline-flex items-center gap-1.5" title={tc('views')}>
              <Eye className="size-4" aria-hidden />
              {formatNumber(post.viewCount ?? 0, loc)}
            </span>
          </div>
        </div>
      </header>

      {/* ══════════ Body + sticky rail ══════════
       * Two columns from `lg` up: the article on the inline-start side and a
       * rail that stays pinned while the reader scrolls. Below `lg` the rail
       * simply stacks under the body — a sticky column on a phone would cover
       * the text. Comments sit outside the grid so they get the full measure. */}
      {/* Breathing room below the title/meta block — the body used to start
          flush against it. */}
      <div className="mx-auto mt-6 max-w-[68rem] px-4 sm:px-6 sm:mt-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-12">
          <main className="min-w-0">
            <div className="max-w-[36rem]">
              <ExpandablePostBody content={post.content} />
            </div>
          </main>

          <aside className="mt-12 space-y-5 lg:sticky lg:top-32 lg:mt-0">
            <div className="card p-3">
              <PostActionRail post={post} />
            </div>

            {author && (
              <AboutAuthor author={author} locale={loc} viewCount={post.viewCount ?? 0} />
            )}
          </aside>
        </div>

        {/* Aligned with the article column on desktop, full width on mobile. */}
        <div className="mx-auto mt-14 max-w-[36rem] sm:mt-16 lg:mx-0">
          <CommentsSection postId={post.id} />
        </div>
      </div>
    </article>
  );
}

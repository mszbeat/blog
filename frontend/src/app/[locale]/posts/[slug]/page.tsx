import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, CalendarDays, Clock, Eye, Tag } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getPostBySlug, ServerApiError } from '@/lib/server-api';
import { PostBody } from '@/components/post-body';
import { PostShareBar } from '@/components/post-share-bar';
import { CommentsSection } from '@/components/comments-section';
import { ApiDownNotice } from '@/components/api-down-notice';
import { Avatar, Badge, Card } from '@/components/ui/primitives';
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
  const rtl = loc === 'fa';

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
        <Link
          href="/posts"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300"
        >
          <ArrowRight className={cn('size-4', !rtl && 'rotate-180')} aria-hidden />
          {t('backToList')}
        </Link>
      </div>
    );
  }

  const cover = resolveMedia(post.coverImage);
  const mins = readingMinutes(post.content ?? '');
  const author = post.author;

  return (
    <article className="pb-16">
      {/* ══════════ Hero ══════════ */}
      <header className="relative overflow-hidden border-b border-line bg-surface">
        {cover ? (
          <div className="relative h-64 w-full sm:h-80 lg:h-96">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt=""
              className="size-full object-cover"
              fetchPriority="high"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-surface via-surface/25 to-transparent"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className={cn('h-40 w-full bg-gradient-to-br sm:h-52', gradientFor(post.slug))}
          />
        )}

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          {/* Categories */}
          {post.categories && post.categories.length > 0 && (
            <div className="-mt-6 flex flex-wrap gap-2">
              {post.categories.map((c) => (
                <Link key={c.id} href={`/categories/${c.slug}`}>
                  <Badge tone="brand" className="bg-surface shadow-sm ring-line">
                    <Tag className="size-3" aria-hidden />
                    {c.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.2]">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mt-4 text-base leading-relaxed text-ink-2 sm:text-lg">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-5 text-sm text-ink-3">
            {author && (
              <span className="flex items-center gap-2.5">
                <Avatar src={author.avatar} name={author.name} size="sm" />
                <span>
                  <span className="block font-semibold text-ink">{author.name}</span>
                  {author.bio && (
                    <span className="block max-w-56 truncate text-xs text-ink-3">{author.bio}</span>
                  )}
                </span>
              </span>
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

      {/* ══════════ Body ══════════ */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mt-10">
          <PostBody content={post.content} />
        </div>

        <PostShareBar title={post.title} locale={loc} />

        {/* Author card */}
        {author && (
          <Card className="mt-10 p-5">
            <div className="flex items-start gap-4">
              <Avatar src={author.avatar} name={author.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {rtl ? 'دربارهٔ نویسنده' : 'About the author'}
                </p>
                <h2 className="mt-1 text-base font-bold text-ink">{author.name}</h2>
                {author.bio && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{author.bio}</p>
                )}
                <p className="num-en mt-2 text-xs text-ink-3">
                  {tc('createdAt')}: {formatDate(author.createdAt, loc)}
                </p>
              </div>
            </div>
          </Card>
        )}

        <Link
          href="/posts"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-300"
        >
          <ArrowRight className={cn('size-4', !rtl && 'rotate-180')} aria-hidden />
          {t('backToList')}
        </Link>

        {/* ══════════ Comments (client) ══════════ */}
        <CommentsSection postId={post.id} />
      </div>
    </article>
  );
}

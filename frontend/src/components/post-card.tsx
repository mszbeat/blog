'use client';

import { useTranslations } from 'next-intl';
import { CalendarDays, Eye, Layers, MessageCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Avatar, Badge, Card } from '@/components/ui/primitives';
import {
  cn, formatDate, formatNumber, gradientFor, readingMinutes, resolveMedia, truncate,
} from '@/lib/utils';
import type { Locale, Post } from '@/lib/types';

/**
 * Post card used across the home page, listing pages and the dashboard.
 *
 * `compact` drops the cover (used in the dashboard where space is tight and
 * GET /post/my does not return `author`).
 */
export function PostCard({
  post, locale, compact = false, showAuthor = true,
}: {
  post: Post;
  locale: Locale;
  compact?: boolean;
  showAuthor?: boolean;
}) {
  const t = useTranslations('posts');
  const tc = useTranslations('common');
  const cover = resolveMedia(post.coverImage);
  const mins = readingMinutes(post.content ?? '');

  return (
    <Card hover className="group flex h-full flex-col overflow-hidden">
      {!compact && (
        <Link
          href={`/posts/${post.slug}`}
          className="relative block aspect-[16/9] w-full overflow-hidden bg-surface-3"
          tabIndex={-1}
          aria-hidden
        >
          {cover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={cover}
              alt=""
              loading="lazy"
              className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <span
              className={cn(
                'flex size-full items-center justify-center',
                gradientFor(post.slug || post.id),
              )}
            >
              <span className="px-6 text-center text-lg font-bold text-white/90 drop-shadow-sm">
                {truncate(post.title, 48)}
              </span>
            </span>
          )}

          {/* Gallery indicator — this post opens as a slideshow. */}
          {(post.images?.length ?? 0) > 1 && (
            <span
              className="num-en absolute bottom-2 flex items-center gap-1 rounded-full bg-slate-950/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm"
              style={{ insetInlineEnd: '0.5rem' }}
            >
              <Layers className="size-2.5" aria-hidden />
              {post.images!.length}
            </span>
          )}

          {!post.published && (
            <span className="absolute top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm"
              style={{ insetInlineEnd: '0.75rem' }}>
              {t('draft')}
            </span>
          )}
        </Link>
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Categories */}
        {post.categories && post.categories.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {post.categories.slice(0, 3).map((c) => (
              <Link key={c.id} href={`/categories/${c.slug}`}>
                <Badge tone="brand" className="transition hover:bg-brand-500/20">
                  {c.name}
                </Badge>
              </Link>
            ))}
            {compact && !post.published && <Badge tone="warning">{t('draft')}</Badge>}
          </div>
        )}
        {compact && post.categories?.length === 0 && !post.published && (
          <div className="mb-2.5"><Badge tone="warning">{t('draft')}</Badge></div>
        )}

        {/* Title */}
        <h3 className="text-lg font-bold leading-snug text-ink">
          <Link
            href={`/posts/${post.slug}`}
            className="transition after:absolute after:inset-0 group-hover:text-brand-600 dark:group-hover:text-brand-300"
          >
            {post.title || tc('untitled')}
          </Link>
        </h3>

        {/* Excerpt */}
        {(post.excerpt || post.content) && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">
            {truncate(post.excerpt || post.content, 150)}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-ink-3">
          {showAuthor && post.author && (
            <span className="flex items-center gap-2">
              <Avatar src={post.author.avatar} name={post.author.name} size="xs" />
              <span className="font-medium text-ink-2">{post.author.name}</span>
            </span>
          )}
          <span className="num-en inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatDate(post.createdAt, locale, { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          <span className="num-en inline-flex items-center gap-1.5" title={tc('minRead')}>
            <span aria-hidden>·</span>
            {formatNumber(mins, locale)} {tc('minRead')}
          </span>
          {post.viewCount > 0 && (
            <span className="num-en inline-flex items-center gap-1.5">
              <Eye className="size-3.5" aria-hidden />
              {formatNumber(post.viewCount, locale)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Horizontal variant for "recent posts" lists in the dashboard. */
export function PostRow({ post, locale }: { post: Post; locale: Locale }) {
  const t = useTranslations('posts');
  const tc = useTranslations('common');
  const cover = resolveMedia(post.coverImage);

  return (
    <Link
      href={`/dashboard/posts/${post.id}/edit`}
      className="group flex items-center gap-4 rounded-xl p-3 transition hover:bg-surface-2"
    >
      <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-3">
        {cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className={cn('flex size-full items-center justify-center bg-gradient-to-br text-white/90', gradientFor(post.slug || post.id))}>
            <MessageCircle className="size-5" aria-hidden />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink group-hover:text-brand-600 dark:group-hover:text-brand-300">
            {post.title || tc('untitled')}
          </span>
          <Badge tone={post.published ? 'success' : 'warning'} className="shrink-0">
            {post.published ? t('published') : t('draft')}
          </Badge>
        </span>
        <span className="num-en mt-1 flex items-center gap-3 text-xs text-ink-3">
          <span>{formatDate(post.createdAt, locale, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3" aria-hidden />
            {formatNumber(post.viewCount, locale)}
          </span>
        </span>
      </span>
    </Link>
  );
}

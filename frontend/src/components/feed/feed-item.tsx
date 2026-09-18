'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarDays, ChevronDown, Eye, MessageCircle, Share2,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Avatar, Badge } from '@/components/ui/primitives';
import { ShareButton } from '@/components/share-button';
import {
  cn, formatDate, formatNumber, formatRelative, gradientFor,
  readingMinutes, resolveMedia, truncate,
} from '@/lib/utils';
import type { Locale, Post } from '@/lib/types';

/** How many characters of the body show before "see more". */
const PREVIEW_CHARS = 320;

/**
 * LinkedIn/Instagram-style feed card.
 *
 * Layout, top to bottom:
 *   author row (avatar + name + role + time)
 *   → category chips
 *   → title
 *   → body preview with "see more"
 *   → full-bleed cover
 *   → stats + action bar
 *
 * NOTE on comment counts: the API has no batch endpoint, and the real backend
 * rate-limits to 10 requests/minute globally — fetching comments for every
 * card would instantly 429. So the action bar links to the post instead of
 * showing a live count.
 */
export function FeedItem({
  post, locale, variant = 'full',
}: {
  post: Post;
  locale: Locale;
  /**
   * `full`    — the standard feed card (author row, body preview, cover).
   * `compact` — shorter version used beside the hero on wide screens: keeps
   *             the author row and cover but clamps the body hard, so the
   *             hero column doesn't grow taller than the copy next to it.
   */
  variant?: 'full' | 'compact';
}) {
  const t = useTranslations('posts');
  const tc = useTranslations('common');
  const tu = useTranslations('users');
  const [expanded, setExpanded] = useState(false);
  const compact = variant === 'compact';

  const cover = resolveMedia(post.coverImage);
  const mins = readingMinutes(post.content ?? '');
  const author = post.author;

  const plain = (post.content ?? '').replace(/[#*>`\-|]/g, '').replace(/\s+/g, ' ').trim();
  const limit = compact ? 140 : PREVIEW_CHARS;
  const needsClamp = plain.length > limit;
  const shown = expanded || !needsClamp ? plain : `${plain.slice(0, limit).trimEnd()}…`;

  return (
    <article className="card card-hover group overflow-hidden animate-fade-up">
      {/* ── Author row ── */}
      <header className="flex items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3.5">
        {author ? (
          <Link href={`/users/${author.id}`} className="shrink-0" aria-label={author.name}>
            <span className="avatar-ring avatar-ring-static block">
              <Avatar src={author.avatar} name={author.name} size="md" className="ring-2 ring-surface" />
            </span>
          </Link>
        ) : (
          <span className="shrink-0">
            <Avatar name={post.title} size="md" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {author ? (
              <Link
                href={`/users/${author.id}`}
                className="truncate text-sm font-bold text-ink transition hover:text-brand-600 dark:hover:text-brand-300"
              >
                {author.name}
              </Link>
            ) : (
              <span className="truncate text-sm font-bold text-ink">{tc('anonymous')}</span>
            )}

            {author?.role === 'admin' && (
              <Badge tone="brand" className="px-1.5 py-0 text-[10px]">
                {tu('roleAdmin')}
              </Badge>
            )}
            {!post.published && <Badge tone="warning" className="px-1.5 py-0 text-[10px]">{t('draft')}</Badge>}
          </div>

          <p className="num-en mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
            <span title={formatDate(post.createdAt, locale, { dateStyle: 'full' })}>
              {formatRelative(post.createdAt, locale)}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" aria-hidden />
              {formatDate(post.createdAt, locale, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </p>

          {author?.bio && !compact && (
            <p className="mt-1 line-clamp-1 text-xs text-ink-3">{author.bio}</p>
          )}
        </div>
      </header>

      {/* ── Categories ── */}
      {post.categories && post.categories.length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-5">
          {post.categories.map((c) => (
            <Link key={c.id} href={`/posts?category=${encodeURIComponent(c.slug)}`} className="chip !py-1 !text-xs">
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {/* ── Title ── */}
      <div className="px-4 sm:px-5">
        <h2 className="text-lg font-extrabold leading-snug text-ink sm:text-xl">
          <Link
            href={`/posts/${post.slug}`}
            className="transition after:absolute after:inset-x-0 after:top-0 after:h-24 group-hover:text-brand-600 dark:group-hover:text-brand-300"
          >
            {post.title || tc('untitled')}
          </Link>
        </h2>

        {post.excerpt && !expanded && (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{post.excerpt}</p>
        )}
      </div>

      {/* ── Body preview ── */}
      {(post.content || post.excerpt) && (
        <div className="mt-2.5 px-4 sm:px-5">
          <p
            className={cn(
              'prose-blog prose-feed m-0 whitespace-pre-line text-ink-2',
              !expanded && needsClamp && (compact ? 'line-clamp-3' : 'line-clamp-5'),
            )}
          >
            {expanded ? plain : (post.excerpt ?? shown)}
          </p>

          {needsClamp && !compact && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-brand-600 transition hover:text-brand-700 dark:text-brand-300"
            >
              {expanded ? t('seeLess') : t('seeMore')}
              <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} aria-hidden />
            </button>
          )}
        </div>
      )}

      {/* ── Cover ── */}
      <Link
        href={`/posts/${post.slug}`}
        className="mt-3.5 block overflow-hidden border-y border-line bg-surface-3"
        tabIndex={-1}
        aria-hidden
      >
        {cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="max-h-[32rem] w-full object-cover transition duration-500 group-hover:scale-[1.015]"
          />
        ) : (
          <span className={cn('flex w-full items-center justify-center bg-gradient-to-br', compact ? 'h-32' : 'h-40 sm:h-48', gradientFor(post.slug || post.id))}>
            <span className="px-8 text-center text-lg font-bold text-white/90 drop-shadow-sm">
              {truncate(post.title, 52)}
            </span>
          </span>
        )}
      </Link>

      {/* ── Stats ── */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3 text-xs text-ink-3 sm:px-5">
        <span className="num-en inline-flex items-center gap-1.5">
          <Eye className="size-3.5" aria-hidden />
          {formatNumber(post.viewCount ?? 0, locale)} {tc('views')}
        </span>
        <span className="num-en">
          {formatNumber(mins, locale)} {tc('minRead')}
        </span>
      </div>

      {/* ── Action bar ── */}
      <div className="mt-2 flex items-center gap-1 border-t border-line px-2 py-1.5 sm:px-3">
        <Link href={`/posts/${post.slug}#comments`} className="feed-action flex-1 justify-center">
          <MessageCircle className="size-[18px]" aria-hidden />
          <span className="hidden sm:inline">{tc('comments')}</span>
        </Link>

        <ShareButton
          title={post.title}
          className="feed-action flex-1 justify-center"
          label={tc('share')}
        />

        <Link href={`/posts/${post.slug}`} className="feed-action flex-1 justify-center !text-brand-600 dark:!text-brand-300">
          <span>{tc('readMore')}</span>
        </Link>
      </div>
    </article>
  );
}

/** Feed-shaped skeleton that matches the real card's proportions. */
export function FeedItemSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-3 p-5">
        <div className="skeleton size-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-32" />
          <div className="skeleton h-3 w-20" />
        </div>
      </div>
      <div className="space-y-2.5 px-5 pb-4">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-5/6" />
      </div>
      <div className="skeleton h-48 w-full rounded-none" />
      <div className="flex gap-2 border-t border-line p-3">
        <div className="skeleton h-8 flex-1 rounded-xl" />
        <div className="skeleton h-8 flex-1 rounded-xl" />
        <div className="skeleton h-8 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Eye, FileText, MessageCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn, formatNumber, gradientFor, resolveMedia, truncate } from '@/lib/utils';
import type { Locale, Post } from '@/lib/types';

/**
 * Instagram-style 3-column square grid.
 * Hover/tap reveals the title plus view count over a dark scrim.
 */
export function PostsGrid({ posts }: { posts: Post[] }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('posts');
  const tc = useTranslations('common');

  if (!posts.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-3 text-ink-3">
          <FileText className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-ink">{t('noPosts')}</p>
        <p className="max-w-xs text-xs text-ink-3">{t('noPostsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3">
      {posts.map((post) => {
        const cover = resolveMedia(post.coverImage);
        return (
          <Link
            key={post.id}
            href={`/posts/${post.slug}`}
            className="group relative aspect-square overflow-hidden rounded-xl bg-surface-3 sm:rounded-2xl"
          >
            {cover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cover}
                alt=""
                loading="lazy"
                className="size-full object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <span
                className={cn(
                  'flex size-full items-center justify-center bg-gradient-to-br p-4 text-center',
                  gradientFor(post.slug || post.id),
                )}
              >
                <span className="line-clamp-3 text-sm font-bold text-white/95 drop-shadow-sm sm:text-base">
                  {truncate(post.title, 60)}
                </span>
              </span>
            )}

            {/* Draft marker */}
            {!post.published && (
              <span
                className="absolute top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm"
                style={{ insetInlineEnd: '0.5rem' }}
              >
                {t('draft')}
              </span>
            )}

            {/* Scrim with stats — always visible on touch, on hover for pointer */}
            <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent p-2.5 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
              <span className="line-clamp-2 text-xs font-bold leading-snug text-white sm:text-sm">
                {post.title}
              </span>
              <span className="num-en mt-1.5 flex items-center gap-3 text-[11px] font-semibold text-white/85">
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3" aria-hidden />
                  {formatNumber(post.viewCount ?? 0, locale)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3" aria-hidden />
                  {tc('comments')}
                </span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function PostsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton aspect-square rounded-xl sm:rounded-2xl" />
      ))}
    </div>
  );
}

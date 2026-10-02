'use client';

/**
 * One notification row.
 *
 * Shared by the header dropdown (`compact`) and the full notifications page.
 *
 * The API already hydrates `actor` and a MINIMAL `post` (id/slug/title/cover),
 * so this renders an avatar, a headline, and a post thumbnail with no extra
 * requests. Clicking anywhere in the row navigates to the right place (post
 * thread for like/comment/reply, actor profile for follow) and marks it read.
 */

import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Avatar } from '@/components/ui/primitives';
import { useMarkNotificationRead, useDeleteNotification } from '@/lib/queries';
import { metaFor, notificationHref } from '@/lib/notifications';
import { cn, formatRelative, resolveMedia, truncate } from '@/lib/utils';
import type { Locale, Notification } from '@/lib/types';

export function NotificationRow({
  notification: n, locale, compact = false, onNavigate,
}: {
  notification: Notification;
  locale: Locale;
  /** Tighter padding + no delete button, for the header dropdown. */
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('notifications');
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  const remove = useDeleteNotification();

  const meta = metaFor(n.type);
  const href = notificationHref(n);
  const cover = resolveMedia(n.post?.coverImage);
  const actorName = n.actor?.name ?? t('someone');

  const go = () => {
    // Reading it is the point of the click, so mark it read even when there is
    // no destination to navigate to.
    if (!n.read) markRead.mutate(n.id);
    onNavigate?.();
    if (href) router.push(href);
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    remove.mutate(n.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={onKeyDown}
      data-unread={!n.read}
      className={cn(
        'notif group cursor-pointer',
        compact ? 'py-2' : 'py-2.5',
      )}
    >
      {/* Type glyph — the emoji is the fastest way to tell the kinds apart. */}
      <span className="notif-icon shrink-0" data-type={n.type} aria-hidden>
        {meta.emoji}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn('text-[13px] leading-snug', n.read ? 'text-ink-2' : 'text-ink')}>
          <span className="font-bold">{actorName}</span>{' '}
          <span className={cn('font-medium', meta.tone)}>{t(meta.labelKey)}</span>
        </p>

        {/* Which post it happened on — the user asked for this explicitly. */}
        {n.post && (
          <p className="mt-1 flex items-start gap-2">
            {cover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cover}
                alt=""
                loading="lazy"
                className="mt-0.5 size-9 shrink-0 rounded-lg object-cover ring-1 ring-line"
              />
            ) : (
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-[11px]" aria-hidden>
                {meta.emoji}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-ink-2">
                {truncate(n.post.title, 72)}
              </span>
              {/* Frozen comment excerpt — survives the comment being edited. */}
              {n.excerpt && (
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-ink-3">
                  “{truncate(n.excerpt, 120)}”
                </span>
              )}
            </span>
          </p>
        )}

        <p className="num-en mt-1 text-[11px] font-medium text-ink-3">
          {formatRelative(n.createdAt, locale)}
        </p>
      </div>

      {/* Actor avatar on the trailing edge (or leading in RTL, via logical props). */}
      {n.actor && !compact && (
        <Avatar src={n.actor.avatar} name={n.actor.name} size="sm" className="mt-0.5 shrink-0" />
      )}

      {!compact && (
        <button
          type="button"
          onClick={onDelete}
          disabled={remove.isPending}
          aria-label={t('delete')}
          className={cn(
            'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-4',
            'opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500',
            'focus-visible:opacity-100 disabled:opacity-40',
          )}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

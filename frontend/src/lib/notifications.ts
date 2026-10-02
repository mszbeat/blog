/**
 * Notification presentation metadata.
 *
 * The four activity types each get a distinct emoji + accent so a glance at the
 * bell panel tells you *what* happened, not just *that* something happened.
 * Kept out of the components so the bell, the dropdown, the full page and the
 * live toast all render identically.
 */

import type { NotificationType } from './types';

export interface NotificationMeta {
  /** Emoji glyph — requested explicitly so the panel is scannable at a glance. */
  emoji: string;
  /** Tailwind text colour for the emoji chip. */
  tone: string;
  /** i18n key inside the `notifications` namespace describing the event. */
  labelKey: 'followedYou' | 'likedYourPost' | 'commentedOnYourPost' | 'repliedToYourComment';
  /** Shorter form used by the live toast summary. */
  shortKey: 'follow' | 'like' | 'comment' | 'reply';
  /** Filter chip colour classes. */
  chipActive: string;
}

export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  follow: {
    emoji: '👤',
    tone: 'text-brand-600 dark:text-brand-300',
    labelKey: 'followedYou',
    shortKey: 'follow',
    chipActive: 'bg-brand-500/15 text-brand-700 dark:text-brand-200 border-brand-400',
  },
  like: {
    emoji: '❤️',
    tone: 'text-plum-500 dark:text-plum-300',
    labelKey: 'likedYourPost',
    shortKey: 'like',
    chipActive: 'bg-plum-500/15 text-plum-600 dark:text-plum-300 border-plum-400',
  },
  comment: {
    emoji: '💬',
    tone: 'text-accent-600 dark:text-accent-300',
    labelKey: 'commentedOnYourPost',
    shortKey: 'comment',
    chipActive: 'bg-accent-500/18 text-accent-600 dark:text-accent-300 border-accent-400',
  },
  reply: {
    emoji: '↩️',
    tone: 'text-emerald-600 dark:text-emerald-300',
    labelKey: 'repliedToYourComment',
    shortKey: 'reply',
    chipActive: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400',
  },
};

/** Stable order for filter chips and the byType breakdown. */
export const NOTIFICATION_TYPES: NotificationType[] = ['follow', 'like', 'comment', 'reply'];

export const metaFor = (type: NotificationType | string): NotificationMeta =>
  NOTIFICATION_META[type as NotificationType] ?? NOTIFICATION_META.comment;

/**
 * Where a notification should take you when clicked.
 *
 * Follows have no post, so they land on the actor's profile; everything else
 * deep-links to the post (and the comment thread when there is one) so the
 * user arrives exactly at the thing they were notified about.
 */
export function notificationHref(n: {
  type: NotificationType | string;
  actor?: { id: string } | null;
  post?: { slug: string } | null;
  commentId?: string | null;
}): string | null {
  if (n.type === 'follow') return n.actor ? `/users/${n.actor.id}` : null;
  if (!n.post?.slug) return n.actor ? `/users/${n.actor.id}` : null;
  const base = `/posts/${n.post.slug}`;
  return n.commentId ? `${base}#comment-${n.commentId}` : `${base}#comments`;
}

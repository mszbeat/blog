'use client';

/**
 * One row in a follower / following list.
 *
 * Avatar + name both link to that person's public profile (the user asked for
 * this to work everywhere), and the trailing control is a compact follow
 * button so you can follow back without leaving the page.
 *
 * `viewerFollowing` is only knowable client-side for the CURRENT viewer, and
 * the edge-list endpoints return bare user records with no relationship flag,
 * so the button starts from "not following" and the optimistic mutation
 * corrects it after the first click.
 */

import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Avatar } from '@/components/ui/primitives';
import { FollowButtonCompact } from '@/components/social/follow-button';
import { useAuth } from '@/lib/auth-context';
import type { User } from '@/lib/types';

export function UserRow({
  user, isFollowing = false, followsYou = false,
}: {
  user: User;
  /** Whether the VIEWER follows this person — drives the button's state. */
  isFollowing?: boolean;
  /** Whether this person follows the viewer — shows the mutual/"follows you" badge. */
  followsYou?: boolean;
}) {
  const t = useTranslations('users');
  const { user: me } = useAuth();

  const isSelf = me?.id === user.id;

  return (
    <div className="group flex items-center gap-3 p-3.5 transition hover:bg-surface-2">
      <Link href={`/users/${user.id}`} aria-label={user.name} className="shrink-0">
        <Avatar
            src={user.avatar}
            name={user.name}
            size="md"
            className="transition group-hover:scale-105"
          />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link
            href={`/users/${user.id}`}
            className="truncate text-sm font-bold text-ink transition group-hover:text-brand-600 dark:group-hover:text-brand-300"
          >
            {user.name}
          </Link>
          {user.role === 'admin' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-1.5 py-px text-[10px] font-bold text-brand-700 dark:text-brand-300">
              <ShieldCheck className="size-2.5" aria-hidden />
              {t('roleAdmin')}
            </span>
          )}
          {/* Mutual connection: they follow you back. */}
          {followsYou && !isSelf && (
            <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10px] font-bold text-ink-3">
              {t('followsYou')}
            </span>
          )}
        </div>
        {user.bio ? (
          <p className="mt-0.5 truncate text-xs text-ink-3">{user.bio}</p>
        ) : (
          <p className="num-en mt-0.5 truncate text-xs text-ink-4">@{user.email.split('@')[0]}</p>
        )}
      </div>

      {/* Nothing to follow on your own row. */}
      {!isSelf && <FollowButtonCompact targetId={user.id} isFollowing={isFollowing} />}
    </div>
  );
}

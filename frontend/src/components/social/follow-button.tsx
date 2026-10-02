'use client';

/**
 * Follow / Unfollow button.
 *
 * STATE OWNERSHIP — three separate bugs used to live here:
 *   1. It painted `toggle.isPending ? !isFollowing : isFollowing` while the
 *      optimistic cache patch had ALREADY flipped the prop, so the two
 *      inversions cancelled: "Follow" appeared not to respond and "Unfollow"
 *      appeared to do nothing.
 *   2. It kept a private mirror, so navigating away and back (Next restores the
 *      previous RSC payload, which is anonymous and says `isFollowing: false`)
 *      reset the button.
 *   3. Its label swap used `hidden` + `group-hover/follow:inline`. The hover variant
 *      out-specifies plain `.hidden`, so hovering a button you did NOT follow
 *      revealed "Unfollow" right next to "Follow".
 *
 *   Now the truth lives in the shared store (lib/social-store) keyed by target
 *   user id, the mutation writes it optimistically and authoritatively, and the
 *   hover label only exists in the branch where it is meaningful.
 *
 * The button never renders for the profile owner, and signed-out visitors are
 * sent to the login page with a `next` return path rather than shown a dead
 * control.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { UserCheck, UserPlus, UserX } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useToggleFollow, useMyFollowingIds } from '@/lib/queries';
import { useFollowState, useSocialStore } from '@/lib/social-store';
import { cn } from '@/lib/utils';

export function FollowButton({
  targetId,
  isFollowing,
  size = 'lg',
  className,
}: {
  targetId: string;
  isFollowing: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const t = useTranslations('profile');
  const { user: me, isAuthenticated, isReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const toggle = useToggleFollow(targetId);
  const store = useSocialStore();
  const ids = useMyFollowingIds();
  useEffect(() => {
    if (ids.data) store.reconcileFollow(targetId, ids.data.has(targetId), ids.dataUpdatedAt);
  }, [store, targetId, ids.data, ids.dataUpdatedAt, toggle.isPending]);

  /* The prop is only a SEED. The store keeps the value the visitor last set, so
   * a back-navigation into a stale, token-less payload cannot flip it back. */
  const following = useFollowState(targetId, isFollowing);

  const isSelf = !!me && me.id === targetId;

  const onClick = () => {
    // Auth may still be resolving on first paint — never bounce a signed-in
    // user to /login because the probe had not finished.
    if (!isReady || isSelf || toggle.isPending || store.isBusy(`follow:${targetId}`)) return;

    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    /* No local state to manage: the mutation drives the store — optimistic in
     * onMutate, authoritative in onSuccess, rolled back in onError. */
    if (ids.data) toggle.mutate(!following);
  };

  return (
    <Button
      type="button"
      size={size}
      variant={following ? 'outline' : 'primary'}
      disabled={!isReady || isSelf || (isAuthenticated && !ids.data)}
      aria-pressed={following}
      aria-label={following ? t('unfollow') : t('follow')}
      onClick={onClick}
      className={cn(
        // `group` drives the followed-state label swap below.
        'group/follow gap-2',
        // Followed reads as "already connected" — quiet, so the primary action
        // on the page stays the content. Hover previews the destructive action.
        following && 'border-brand-400/60 bg-brand-500/8 text-brand-700 hover:!border-rose-400 hover:!bg-rose-500/8 hover:!text-rose-600 dark:text-brand-200 dark:hover:!text-rose-400',
        className,
      )}
      title={following ? t('unfollow') : t('follow')}
    >
      {following ? (
        <>
          <UserCheck className="size-4 shrink-0 group-hover/follow:hidden" aria-hidden />
          <UserX className="hidden size-4 shrink-0 group-hover/follow:block" aria-hidden />
          <span className="group-hover/follow:hidden">{t('following')}</span>
          {/* Visual-only: `aria-hidden` plus the button's aria-label keep a
              screen reader from announcing "Following Unfollow". */}
          <span className="hidden group-hover/follow:inline" aria-hidden>{t('unfollow')}</span>
        </>
      ) : (
        <>
          <UserPlus className="size-4 shrink-0" aria-hidden />
          <span>{t('follow')}</span>
        </>
      )}
    </Button>
  );
}

/**
 * Compact follow control for user lists (people search, followers / following
 * tabs). Same behaviour, sized for a dense row.
 */
export function FollowButtonCompact({
  targetId, isFollowing, className,
}: {
  targetId: string; isFollowing: boolean; className?: string;
}) {
  return (
    <FollowButton
      targetId={targetId}
      isFollowing={isFollowing}
      size="sm"
      className={cn('min-w-28', className)}
    />
  );
}

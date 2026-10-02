'use client';

/**
 * Like button.
 *
 * The backend endpoint is a TOGGLE, so this component owns the intent: it
 * decides whether the click means "like" or "unlike", paints that immediately
 * (optimistic), and lets the server's authoritative `{liked, likeCount}`
 * correct any drift.
 *
 * Two rendering modes:
 *   variant="feed"   — compact icon + count for the feed action bar
 *   variant="detail" — larger pill with a label, for the post page
 *
 * Signed-out visitors are routed to /login?next=… rather than shown a dead
 * button; liking is the single most common reason to create an account.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLikedPostIds, useToggleLike } from '@/lib/queries';
import { usePostSocial, useSocialStore } from '@/lib/social-store';
import { cn, formatNumber } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export function LikeButton({
  postId,
  initialLiked = false,
  initialCount = 0,
  variant = 'feed',
  className,
  label,
}: {
  postId: string;
  /** `likedByMe` from the API — false for anonymous visitors. */
  initialLiked?: boolean;
  initialCount?: number;
  variant?: 'feed' | 'detail';
  className?: string;
  /** Override the visible label (defaults to the translated "Like"). */
  label?: string;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations('posts');
  const { user, isAuthenticated, isReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const toggle = useToggleLike(postId);
  const store = useSocialStore();

  /* Server-rendered lists (home, /posts, category) are fetched WITHOUT a token,
   * so their `likedByMe` is always false even for posts you liked — the heart
   * came back empty after a refresh while the count stayed correct. The
   * viewer's liked-id set repairs that without re-fetching every list. */
  const likedIdsQ = useLikedPostIds(user?.id, isAuthenticated && !!user);

  /* The viewer's own liked-id set is the SINGLE source of truth once loaded.
   * `initialLiked` is a server snapshot that never changes, so OR-ing the two
   * made an UN-like snap straight back to "liked" the moment the set refetched
   * — most visibly on the server-rendered post page. */
  const serverLiked = likedIdsQ.data ? likedIdsQ.data.has(postId) : initialLiked;

  /* ONE source of truth for this post's numbers, shared with the feed card, the
   * article rail and the comment bubble. The button keeps no mirror of its own:
   * a private copy is exactly what drifted out of step with the count beside it
   * and made the heart refill itself after an unlike. */
  const social = usePostSocial(postId, 'like', { liked: serverLiked, likeCount: initialCount });
  useEffect(() => {
    if (likedIdsQ.data) store.reconcileLiked(postId, likedIdsQ.data.has(postId), likedIdsQ.dataUpdatedAt);
  }, [store, postId, likedIdsQ.data, likedIdsQ.dataUpdatedAt, toggle.isPending]);
  const liked = social.liked;
  const count = social.likeCount;

  const [burst, setBurst] = useState(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);

  const fireBurst = () => {
    setBurst(true);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(false), 520);
  };

  const onClick = () => {
    // Auth is still resolving on first paint — don't bounce a signed-in user
    // to the login page because the probe hadn't finished.
    if (!isReady) return;

    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (toggle.isPending || store.isBusy(`like:${postId}`) || !likedIdsQ.data) return;

    const next = !liked;
    if (next) fireBurst();

    /* The mutation owns the whole lifecycle now: optimistic write in onMutate,
     * authoritative numbers in onSuccess, rollback in onError — all against the
     * shared store, so the heart and the count can never disagree. */
    toggle.mutate(next);
  };

  const text = label ?? (liked ? t('liked') : t('like'));

  if (variant === 'detail') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!isReady || (isAuthenticated && !likedIdsQ.data)}
        aria-pressed={liked}
        data-liked={liked}
        aria-label={text}
        className={cn(
          'like-btn inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold',
          'transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]',
          'disabled:pointer-events-none disabled:opacity-60',
          liked
            ? 'border-plum-400/50 bg-plum-500/10 text-plum-600 dark:text-plum-300'
            : 'border-line-strong bg-surface text-ink-2 hover:border-plum-400 hover:text-plum-600 dark:hover:text-plum-300',
          className,
        )}
      >
        <span className="relative inline-flex">
          {burst && <span className="like-burst" aria-hidden />}
          <Heart
            className={cn('size-[18px] transition-transform', liked && 'scale-110 fill-current animate-pop')}
            aria-hidden
          />
        </span>
        {text}
        <span className="num-en rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-extrabold text-ink-2">
          {formatNumber(count, locale)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isReady || (isAuthenticated && !likedIdsQ.data)}
      aria-pressed={liked}
      aria-label={text}
      data-liked={liked}
      className={cn(
        'like-btn feed-action flex-1 justify-center disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
    >
      <span className="relative inline-flex">
        {burst && <span className="like-burst" aria-hidden />}
        <Heart className={cn('size-[18px]', liked && 'fill-current animate-pop')} aria-hidden />
      </span>
      <span className="num-en">{formatNumber(count, locale)}</span>
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}

/** Read-only like count for contexts with no interaction (grids, cards). */
export function LikeCount({ count, className }: { count: number; className?: string }) {
  const locale = useLocale() as Locale;
  return (
    <span className={cn('num-en inline-flex items-center gap-1.5', className)}>
      <Heart className={cn('size-3.5', count > 0 && 'fill-plum-500 text-plum-500')} aria-hidden />
      {formatNumber(count, locale)}
    </span>
  );
}

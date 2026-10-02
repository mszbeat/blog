'use client';

/**
 * Live notification toast.
 *
 * The user asked for a modal at the top-centre of the screen when a
 * notification arrives while they are online. There is no websocket gateway on
 * the backend, so this polls `GET /notifications/unread` (which is
 * `@SkipThrottle()`d server-side) and diffs the newest id against what it has
 * already shown.
 *
 * Design notes:
 *   • It only ever shows notifications NEWER than the first poll's baseline, so
 *     signing in does not immediately fire a stack of old alerts.
 *   • The tab must be visible (`document.visibilityState`) — a background tab
 *     queuing toasts would spam the user on return.
 *   • Batching: if several arrive in one poll they render as ONE card with a
 *     summary line, then auto-dismiss.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useUnreadNotifications, useMarkNotificationRead } from '@/lib/queries';
import { metaFor, notificationHref } from '@/lib/notifications';
import { cn, formatRelative, resolveMedia, truncate } from '@/lib/utils';
import type { Locale, Notification } from '@/lib/types';

/** How long a toast stays before it lifts away on its own. */
const AUTO_DISMISS_MS = 7000;
/** Poll cadence — 20s feels live without hammering the API. */
const POLL_MS = 20_000;

export function LiveNotificationToast() {
  const locale = useLocale() as Locale;
  const t = useTranslations('notifications');
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  const enabled = isAuthenticated && isReady;
  const { data } = useUnreadNotifications(enabled, POLL_MS);

  const [visible, setVisible] = useState<Notification[] | null>(null);
  const [leaving, setLeaving] = useState(false);

  /** Highest id (by createdAt) we have already announced. */
  const seenRef = useRef<string | null>(null);
  /** Baseline is set on the FIRST successful poll so history never fires. */
  const primedRef = useRef(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRead = useMarkNotificationRead();

  const dismiss = useCallback(() => {
    setLeaving(true);
    // Let the exit animation finish before unmounting the node.
    setTimeout(() => { setVisible(null); setLeaving(false); }, 260);
  }, []);

  const scheduleDismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  }, [dismiss]);

  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);

  // Diff each poll against what has already been announced.
  useEffect(() => {
    if (!data) return;
    const latest = data.latest ?? [];
    if (latest.length === 0) { primedRef.current = true; return; }

    // `latest` arrives newest-first from the API.
    const newestId = latest[0].id;

    if (!primedRef.current) {
      // First poll after signing in: record the watermark, show nothing.
      primedRef.current = true;
      seenRef.current = newestId;
      return;
    }

    if (seenRef.current === newestId) return;

    // Everything strictly newer than the watermark.
    const seen = seenRef.current;
    const fresh = seen
      ? latest.slice(0, Math.max(1, latest.findIndex((n) => n.id === seen)))
      : latest.slice(0, 1);

    seenRef.current = newestId;

    // Only announce while the user is actually looking at the tab.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (fresh.length === 0) return;

    setVisible(fresh);
    setLeaving(false);
    scheduleDismiss();
  }, [data, scheduleDismiss]);

  // Reset the watermark on sign-out so the next sign-in re-baselines.
  useEffect(() => {
    if (!enabled) { primedRef.current = false; seenRef.current = null; setVisible(null); }
  }, [enabled]);

  if (!visible || visible.length === 0) return null;

  const primary = visible[0];
  const meta = metaFor(primary.type);
  const extra = visible.length - 1;
  const href = notificationHref(primary);
  const cover = resolveMedia(primary.post?.coverImage);

  const open = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (!primary.read) markRead.mutate(primary.id);
    dismiss();
    if (href) router.push(href);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-[70] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        onClick={open}
        className={cn(
          'pointer-events-auto w-full max-w-md cursor-pointer overflow-hidden rounded-2xl',
          'border border-line bg-surface/95 shadow-elev-3 backdrop-blur-xl',
          leaving ? 'animate-toast-out' : 'animate-toast-in',
        )}
      >
        {/* Type-coloured top edge — readable even before the text is. */}
        <div
          aria-hidden
          className={cn(
            'h-1 w-full',
            primary.type === 'follow' && 'bg-brand-500',
            primary.type === 'like' && 'bg-plum-500',
            primary.type === 'comment' && 'bg-accent-500',
            primary.type === 'reply' && 'bg-emerald-500',
          )}
        />

        <div className="flex items-start gap-3 p-3.5">
          <span className="notif-icon shrink-0" data-type={primary.type} aria-hidden>
            {meta.emoji}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug text-ink">
              <span className="font-bold">{primary.actor?.name ?? t('someone')}</span>{' '}
              <span className={cn('font-medium', meta.tone)}>{t(meta.labelKey)}</span>
            </p>

            {primary.post && (
              <p className="mt-1.5 flex items-center gap-2">
                {cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={cover}
                    alt=""
                    className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-line"
                  />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-[11px]" aria-hidden>
                    {meta.emoji}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-ink-2">
                    {truncate(primary.post.title, 60)}
                  </span>
                  {primary.excerpt && (
                    <span className="mt-0.5 block truncate text-[11px] text-ink-3">
                      “{truncate(primary.excerpt, 70)}”
                    </span>
                  )}
                </span>
              </p>
            )}

            <p className="num-en mt-1.5 flex items-center gap-2 text-[11px] font-medium text-ink-3">
              <span>{formatRelative(primary.createdAt, locale)}</span>
              {/* Batched summary when several arrived in one poll. */}
              {extra > 0 && (
                <span className="rounded-full bg-surface-3 px-2 py-0.5 font-bold text-ink-2">
                  {t('andMore', { count: extra })}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            aria-label={t('dismiss')}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-4 transition hover:bg-surface-3 hover:text-ink"
          >
            <span aria-hidden className="text-base leading-none">×</span>
          </button>
        </div>
      </div>
    </div>
  );
}

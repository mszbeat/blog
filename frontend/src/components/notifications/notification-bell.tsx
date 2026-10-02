'use client';

/**
 * Notification bell — header entry point to the activity feed.
 *
 * Two pieces of state drive it:
 *   • the unread SUMMARY (polled by `useUnreadNotifications`, @SkipThrottle on
 *     the backend) → badge count + the "latest few" preview
 *   • the notification LIST, fetched lazily the first time the panel opens so
 *     a visitor who never clicks the bell costs zero extra requests
 *
 * Marking read is optimistic: the badge drops immediately and rolls back if the
 * PATCH fails.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, CheckCheck, Loader2, Settings2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  useMarkAllNotificationsRead, useNotifications, useUnreadNotifications,
} from '@/lib/queries';
import { NotificationRow } from '@/components/notifications/notification-row';
import { cn, formatNumber } from '@/lib/utils';
import type { Locale } from '@/lib/types';

/** How many rows the dropdown shows before "see all". */
const PREVIEW_LIMIT = 8;

export function NotificationBell({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('notifications');
  const { isAuthenticated } = useAuth();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  /* Polling is gated on auth: an anonymous visitor has no notifications, and
   * leaving the interval running would just burn 401s. */
  const { data: unread } = useUnreadNotifications(isAuthenticated);
  const count = unread?.count ?? 0;

  // The list is only worth fetching once the panel is actually open.
  const [hasOpened, setHasOpened] = useState(false);
  const { data, isFetching, refetch } = useNotifications(
    { page: 1, limit: PREVIEW_LIMIT },
    isAuthenticated && hasOpened,
  );
  const items = data?.data ?? [];

  const markAll = useMarkAllNotificationsRead();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setHasOpened(true);
      // Re-read on every open so the panel is never showing stale rows.
      void refetch();
    }
  };

  // Outside click + Escape close the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // A route change closes it (the header persists across navigations).
  useEffect(() => { setOpen(false); }, [locale]);

  if (!isAuthenticated) return null;

  return (
    <div className={cn('relative', className)} ref={wrapRef}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('title')}
        className={cn(
          'relative inline-flex size-9 items-center justify-center rounded-xl border transition',
          open
            ? 'border-brand-400 bg-brand-500/10 text-brand-600 dark:text-brand-300'
            : 'border-line-strong bg-surface text-ink-2 hover:border-brand-400 hover:text-ink',
        )}
      >
        {/* The bell shakes once when a fresh notification arrives. */}
        <Bell
          className={cn('size-[18px]', unread && count > 0 && 'animate-bell')}
          aria-hidden
          key={count /* re-trigger the animation on each change */}
        />

        {count > 0 && (
          <span
            className={cn(
              'num-en absolute -top-1.5 -end-1.5 flex min-w-[1.15rem] items-center justify-center',
              'rounded-full bg-plum-500 px-1 text-[10px] font-extrabold leading-[1.15rem] text-white',
              'ring-2 ring-surface-2 shadow-plum',
            )}
          >
            {count > 99 ? '99+' : formatNumber(count, 'en')}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className={cn(
            'absolute end-0 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl',
            'border border-line bg-surface shadow-elev-3 animate-slide-down',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <Bell className="size-4 text-brand-500" aria-hidden />
              {t('title')}
              {count > 0 && (
                <span className="num-en rounded-full bg-plum-500/12 px-2 py-0.5 text-[11px] font-extrabold text-plum-600 dark:text-plum-300">
                  {formatNumber(count, locale)}
                </span>
              )}
            </h2>

            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={count === 0 || markAll.isPending}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold transition',
                'text-brand-600 hover:bg-brand-500/10 dark:text-brand-300',
                'disabled:pointer-events-none disabled:opacity-40',
              )}
            >
              {markAll.isPending
                ? <Loader2 className="size-3.5 animate-spin" aria-hidden />
                : <CheckCheck className="size-3.5" aria-hidden />}
              {t('markAllRead')}
            </button>
          </div>

          {/* Rows */}
          <div className="max-h-[24rem] overflow-y-auto overscroll-contain p-1.5">
            {isFetching && items.length === 0 ? (
              <div className="space-y-1.5 p-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 rounded-xl p-2">
                    <div className="skeleton size-9 shrink-0 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-4/5" />
                      <div className="skeleton h-2.5 w-2/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-3 text-xl" aria-hidden>
                  🔔
                </span>
                <p className="text-sm font-bold text-ink">{t('empty')}</p>
                <p className="max-w-[16rem] text-xs text-ink-3">{t('emptyHint')}</p>
              </div>
            ) : (
              items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  locale={locale}
                  onNavigate={() => setOpen(false)}
                  compact
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2 px-3 py-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-brand-600 transition hover:bg-brand-500/10 dark:text-brand-300"
            >
              <Settings2 className="size-3.5" aria-hidden />
              {t('viewAll')}
            </Link>
            {unread && unread.byType && (
              <span className="num-en flex items-center gap-2 text-[11px] font-semibold text-ink-3">
                {(['follow', 'like', 'comment', 'reply'] as const).map((k) => (
                  unread.byType[k] > 0 ? (
                    <span key={k} title={t(`types.${k}`)}>
                      {k === 'follow' ? '👤' : k === 'like' ? '❤️' : k === 'comment' ? '💬' : '↩️'}
                      {' '}{formatNumber(unread.byType[k], locale)}
                    </span>
                  ) : null
                ))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

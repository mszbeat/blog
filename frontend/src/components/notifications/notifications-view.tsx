'use client';

/**
 * Full notifications page body.
 *
 * Filters (all / unread / one type) are kept in component state rather than the
 * URL: they are cheap to re-fetch and the page is a private inbox, so there is
 * nothing worth deep-linking to.
 *
 * The list is server-paginated — `GET /notifications` returns the usual
 * `{data, meta}` envelope, so the shared Pagination component drives it.
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { useToast } from '@/components/toast';
import {
  useMarkAllNotificationsRead, useNotifications, useUnreadNotifications,
} from '@/lib/queries';
import { NotificationRow } from '@/components/notifications/notification-row';
import { NOTIFICATION_TYPES, metaFor } from '@/lib/notifications';
import { cn, formatNumber } from '@/lib/utils';
import type { Locale, NotificationType } from '@/lib/types';

const PAGE_SIZE = 15;

type Filter = 'all' | 'unread' | NotificationType;

export function NotificationsView() {
  const locale = useLocale() as Locale;
  const t = useTranslations('notifications');
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);

  const { data: unread } = useUnreadNotifications(true);
  const counts = unread?.byType;

  // `unread` maps to the API's boolean filter; a type maps to `type`.
  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filter === 'unread' ? { unread: true } : {}),
    ...(NOTIFICATION_TYPES.includes(filter as NotificationType)
      ? { type: filter as NotificationType }
      : {}),
  };

  const { data, isLoading, isFetching, isError, refetch } = useNotifications(query);
  const items = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const totalItems = data?.meta?.total;

  const markAll = useMarkAllNotificationsRead();

  const onMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => toast.success(t('markedAll')),
      onError: () => toast.error(t('title')),
    });
  };

  const changeFilter = (f: Filter) => { setFilter(f); setPage(1); };

  const FILTERS: { id: Filter; label: string; emoji?: string; count?: number }[] = [
    { id: 'all', label: t('filterAll'), count: totalItems },
    { id: 'unread', label: t('filterUnread'), count: unread?.count },
    ...NOTIFICATION_TYPES.map((ty) => ({
      id: ty as Filter,
      label: t(`types.${metaFor(ty).shortKey}`),
      emoji: metaFor(ty).emoji,
      count: counts?.[ty],
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      {/* ── Heading ── */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip !border-brand-500/25 !bg-brand-500/8 !text-brand-700 dark:!text-brand-300">
            <Bell className="size-3.5" aria-hidden />
            {t('title')}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t('pageTitle')}
          </h1>
          <p className="mt-1.5 max-w-lg text-sm text-ink-3">{t('pageDesc')}</p>
        </div>

        <Button
          variant="outline"
          size="md"
          onClick={onMarkAll}
          loading={markAll.isPending}
          disabled={!unread?.count}
          className="gap-2"
        >
          <CheckCheck className="size-4" aria-hidden />
          {t('markAllRead')}
          {!!unread?.count && (
            <span className="num-en rounded-md bg-plum-500/12 px-1.5 py-0.5 text-[11px] font-extrabold text-plum-600 dark:text-plum-300">
              {formatNumber(unread.count, locale)}
            </span>
          )}
        </Button>
      </header>

      {/* ── Filter chips ── */}
      <nav
        aria-label={t('title')}
        className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {FILTERS.map(({ id, label, emoji, count }) => {
          const active = filter === id;
          const meta = NOTIFICATION_TYPES.includes(id as NotificationType)
            ? metaFor(id as NotificationType)
            : null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => changeFilter(id)}
              aria-pressed={active}
              className={cn(
                'chip shrink-0',
                active && (meta ? meta.chipActive : 'chip-active'),
              )}
            >
              {emoji && <span aria-hidden>{emoji}</span>}
              {label}
              {typeof count === 'number' && count > 0 && (
                <span className="num-en text-[10px] font-extrabold opacity-75">
                  {formatNumber(count, locale)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── List ── */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-4">
                <div className="skeleton size-9 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-3/5" />
                  <div className="skeleton h-3 w-4/5" />
                  <div className="skeleton h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<Bell className="size-6" aria-hidden />}
            title={t('title')}
            description={t('emptyHint')}
            action={(
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                {t('filterAll')}
              </Button>
            )}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" aria-hidden />}
            title={filter === 'all' ? t('empty') : t('noResults')}
            description={filter === 'all' ? t('emptyHint') : t('noResultsHint')}
            action={filter !== 'all' ? (
              <Button variant="outline" size="sm" onClick={() => changeFilter('all')}>
                {t('filterAll')}
              </Button>
            ) : undefined}
          />
        ) : (
          <>
            {/* A thin progress line while a page change refetches. */}
            {isFetching && (
              <div className="flex items-center justify-center gap-2 border-b border-line bg-surface-2 py-1.5 text-[11px] font-semibold text-ink-3">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                {t('title')}…
              </div>
            )}
            <div className="divide-y divide-line p-1.5">
              {items.map((n) => (
                <NotificationRow key={n.id} notification={n} locale={locale} />
              ))}
            </div>
          </>
        )}
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        locale={locale}
        className="mt-6"
        total={totalItems}
      />
    </div>
  );
}

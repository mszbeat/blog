'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn, formatNumber } from '@/lib/utils';
import type { Locale } from '@/lib/types';

/**
 * Page numbers + prev/next.
 * Arrows flip with document direction so "next" always points forward
 * visually, in both RTL and LTR.
 */
export function Pagination({
  page, totalPages, onChange, locale, className, total,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  locale: Locale;
  className?: string;
  total?: number;
}) {
  const t = useTranslations('common');
  if (totalPages <= 1) return null;

  // Window of pages around the current one.
  const pages: (number | 'gap')[] = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(totalPages, page + 2);
  if (from > 1) {
    pages.push(1);
    if (from > 2) pages.push('gap');
  }
  for (let i = from; i <= to; i++) pages.push(i);
  if (to < totalPages) {
    if (to < totalPages - 1) pages.push('gap');
    pages.push(totalPages);
  }

  const btn =
    'inline-flex size-9 items-center justify-center rounded-lg text-sm font-semibold transition ' +
    'disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav
      aria-label={locale === 'fa' ? 'صفحه‌بندی' : 'Pagination'}
      className={cn('flex flex-col items-center gap-3', className)}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label={t('previous')}
          className={cn(btn, 'border border-line-strong bg-surface text-ink-2 hover:border-brand-500 hover:text-brand-600')}
        >
          <ChevronRight className="size-4 rtl:hidden" aria-hidden />
          <ChevronLeft className="hidden size-4 rtl:block" aria-hidden />
        </button>

        {pages.map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-ink-3" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                btn,
                'num-en min-w-9 px-2',
                p === page
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                  : 'border border-line-strong bg-surface text-ink-2 hover:border-brand-500 hover:text-brand-600',
              )}
            >
              {formatNumber(p, locale)}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={t('next')}
          className={cn(btn, 'border border-line-strong bg-surface text-ink-2 hover:border-brand-500 hover:text-brand-600')}
        >
          <ChevronLeft className="size-4 rtl:hidden" aria-hidden />
          <ChevronRight className="hidden size-4 rtl:block" aria-hidden />
        </button>
      </div>

      {typeof total === 'number' && (
        <p className="num-en text-xs text-ink-3">
          {t('page')} {formatNumber(page, locale)} {t('of')} {formatNumber(totalPages, locale)}
          {' · '}
          {formatNumber(total, locale)} {t('resultsCount', { count: total }).replace(/^\d+\s*/, '')}
        </p>
      )}
    </nav>
  );
}

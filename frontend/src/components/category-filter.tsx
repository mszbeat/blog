'use client';

import { Layers } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn, formatNumber } from '@/lib/utils';
import type { Category, Locale } from '@/lib/types';

/**
 * Horizontal chip row of category filters.
 * Implemented as links (not buttons) so filtering stays crawlable and
 * back/forward navigation works — the page reads `?category=` server-side.
 */
export function CategoryFilter({
  categories, active, locale,
}: {
  categories: Category[];
  active: string | null;
  locale: Locale;
}) {
  if (!categories.length) return null;

  return (
    <div
      role="group"
      aria-label={locale === 'fa' ? 'فیلتر دسته‌بندی' : 'Category filter'}
      className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      <Chip href="/posts" active={!active} label={locale === 'fa' ? 'همه' : 'All'} icon />
      {categories.map((c) => (
        <Chip
          key={c.id}
          href={`/posts?category=${encodeURIComponent(c.slug)}`}
          active={active === c.slug}
          label={c.name}
          count={(c.posts?.length as number | undefined) ?? undefined}
          locale={locale}
        />
      ))}
    </div>
  );
}

function Chip({
  href, active, label, count, icon, locale = 'fa',
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  icon?: boolean;
  locale?: Locale;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold',
        'transition active:scale-[0.98]',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25'
          : 'border-line-strong bg-surface text-ink-2 hover:border-brand-400 hover:text-brand-600',
      )}
    >
      {icon && <Layers className="size-3.5" aria-hidden />}
      {label}
      {typeof count === 'number' && count > 0 && (
        <span className={cn('num-en text-xs', active ? 'text-white/75' : 'text-ink-3')}>
          {formatNumber(count, locale)}
        </span>
      )}
    </Link>
  );
}

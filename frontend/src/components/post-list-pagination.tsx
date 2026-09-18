'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { Pagination } from '@/components/ui/pagination';
import type { Locale, Paginated } from '@/lib/types';

/**
 * Pagination for the public post list.
 * Navigating pushes `?page=` (keeping `?category=`) rather than refetching on
 * the client, so each page stays a crawlable, cacheable URL.
 */
export function PostListPagination({
  page, meta, category,
}: {
  page: number;
  meta: Paginated<unknown>['meta'];
  category?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;

  const go = (next: number) => {
    const qs = new URLSearchParams();
    if (next > 1) qs.set('page', String(next));
    if (category) qs.set('category', category);
    const s = qs.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: true });
  };

  return (
    <Pagination
      page={page}
      totalPages={meta.totalPages}
      total={meta.total}
      locale={locale}
      onChange={go}
      className="mt-10"
    />
  );
}

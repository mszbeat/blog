'use client';

import { useRouter } from 'next/navigation';
import { Pagination } from '@/components/ui/pagination';
import type { Locale, Pagination as PaginationData } from '@/lib/types';

/**
 * The feed itself is server-rendered for SEO; this small client island only
 * owns pagination. The server passes the current page in as a prop, so we
 * never need useSearchParams (and therefore no extra Suspense boundary).
 */
export function PostsClient({
  pagination, category, limit, locale,
}: {
  pagination: PaginationData;
  category?: string | null;
  limit: number;
  locale: Locale;
}) {
  const router = useRouter();
  if (!pagination || pagination.totalPages <= 1) return null;

  const buildHref = (next: number) => {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    if (limit !== 12) p.set('limit', String(limit));
    if (next > 1) p.set('page', String(next));
    const qs = p.toString();
    return `/posts${qs ? `?${qs}` : ''}`;
  };

  return (
    <Pagination
      page={pagination.page}
      totalPages={pagination.totalPages}
      locale={locale}
      total={pagination.totalItems ?? undefined}
      className="mt-8"
      onChange={(next) => router.push(buildHref(next), { scroll: true })}
    />
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Eye, FilePlus2, FileText, MoreHorizontal, Pencil, Search, Trash2,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { useDeletePost, useMyPosts } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import {
  Badge, Card, CardHeader, EmptyState, Skeleton,
} from '@/components/ui/primitives';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate, formatNumber, resolveMedia, truncate } from '@/lib/utils';
import type { Locale, Post } from '@/lib/types';

const PAGE_SIZE = 10;

export default function MyPostsPage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('posts');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const { user } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Fetch a wider window so client-side search can filter without a new
  // endpoint — the backend has no title search parameter.
  const { data, isLoading, isError, refetch } = useMyPosts({ page: 1, limit: 100 });
  const deleteMut = useDeletePost();

  const all = data?.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.excerpt?.toLowerCase().includes(q),
    );
  }, [all, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMut.mutateAsync(pendingDelete.id);
      toast.success(t('deletedSuccess'));
      setPendingDelete(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      toast.error(tc('error'), msg);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={tn('myPosts')}
          description={
            typeof data?.meta?.total === 'number'
              ? tc('resultsCount', { count: formatNumber(data.meta.total, locale) })
              : undefined
          }
          icon={<FileText className="size-[18px]" aria-hidden />}
          action={
            <Link href="/dashboard/posts/new">
              <Button size="sm">
                <FilePlus2 className="size-4" aria-hidden />
                {t('newPost')}
              </Button>
            </Link>
          }
        />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="min-w-52 flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              leadingIcon={<Search className="size-4" aria-hidden />}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isLoading}>
            {tc('retry')}
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<FileText className="size-6" aria-hidden />}
            title={tc('error')}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{tc('retry')}</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" aria-hidden />}
            title={search ? t('noPosts') : t('noMyPosts')}
            description={search ? t('noPostsDesc') : t('noMyPostsDesc')}
            action={
              search ? (
                <Button variant="secondary" size="sm" onClick={() => onSearch('')}>{tc('all')}</Button>
              ) : (
                <Link href="/dashboard/posts/new"><Button size="sm">{t('newPost')}</Button></Link>
              )
            }
          />
        ) : (
          <>
            {/* Header row — hidden on mobile, where each row becomes a card */}
            <div className="hidden items-center gap-4 border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-3 md:flex">
              <span className="flex-1">{t('title')}</span>
              <span className="w-24">{tc('status')}</span>
              <span className="num-en w-20 text-end">{t('viewCount')}</span>
              <span className="num-en w-28">{tc('updatedAt')}</span>
              <span className="w-10" />
            </div>

            <ul className="divide-y divide-line">
              {rows.map((post) => {
                const cover = resolveMedia(post.coverImage);
                const isOwner = post.authorId === user?.id;
                return (
                  <li
                    key={post.id}
                    className="group relative flex flex-col gap-3 p-4 transition hover:bg-surface-2 md:flex-row md:items-center md:gap-4"
                  >
                    {/* Thumbnail */}
                    <span className="relative hidden size-12 shrink-0 overflow-hidden rounded-lg bg-surface-3 sm:block">
                      {cover ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={cover} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-ink-3">
                          <FileText className="size-4" aria-hidden />
                        </span>
                      )}
                    </span>

                    {/* Title + excerpt */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/posts/${post.slug}`}
                          className="truncate text-sm font-semibold text-ink transition hover:text-brand-600 dark:hover:text-brand-300"
                          title={post.title}
                        >
                          {post.title || tc('untitled')}
                        </Link>
                        <Badge tone={post.published ? 'success' : 'warning'}>
                          {post.published ? t('published') : t('draft')}
                        </Badge>
                        {!isOwner && <Badge tone="info">{locale === 'fa' ? 'دیگران' : 'others'}</Badge>}
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-3">
                        {truncate(post.excerpt || post.content || '', 90)}
                      </p>
                      <p className="num-en mt-1 flex items-center gap-3 text-[11px] text-ink-3 md:hidden">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3" aria-hidden />
                          {formatNumber(post.viewCount ?? 0, locale)}
                        </span>
                        <span>{formatDate(post.updatedAt, locale)}</span>
                      </p>
                    </div>

                    {/* Desktop columns */}
                    <span className="hidden w-24 md:block">
                      <Badge tone={post.published ? 'success' : 'warning'}>
                        {post.published ? t('published') : t('draft')}
                      </Badge>
                    </span>
                    <span className="num-en hidden w-20 text-end text-sm text-ink-2 md:block">
                      {formatNumber(post.viewCount ?? 0, locale)}
                    </span>
                    <span className="num-en hidden w-28 text-xs text-ink-3 md:block">
                      {formatDate(post.updatedAt, locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>

                    {/* Actions */}
                    <div className="relative flex shrink-0 items-center gap-1.5">
                      <Link href={`/dashboard/posts/${post.id}/edit`} aria-label={tc('edit')}>
                        <Button variant="secondary" size="iconSm">
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                      </Link>
                      <Link href={`/posts/${post.slug}`} aria-label={tc('viewAll')}>
                        <Button variant="ghost" size="iconSm">
                          <Eye className="size-3.5" aria-hidden />
                        </Button>
                      </Link>

                      <button
                        type="button"
                        onClick={() => setMenuOpen(menuOpen === post.id ? null : post.id)}
                        aria-expanded={menuOpen === post.id}
                        aria-label={tc('actions')}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-3 hover:text-ink"
                      >
                        <MoreHorizontal className="size-4" aria-hidden />
                      </button>

                      {menuOpen === post.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} aria-hidden />
                          <div className="absolute end-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/10 animate-fade-up">
                            <button
                              type="button"
                              onClick={() => { setMenuOpen(null); setPendingDelete(post); }}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-4" aria-hidden />
                              {tc('delete')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {filtered.length > PAGE_SIZE && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                total={filtered.length}
                locale={locale}
                onChange={setPage}
                className="border-t border-line p-4"
              />
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleteMut.isPending}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc', { title: pendingDelete?.title ?? '' })}
        confirmLabel={tc('delete')}
      />
    </div>
  );
}

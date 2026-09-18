'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, FileQuestion, Pencil, ShieldAlert } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import { useDeletePost, useMyPosts } from '@/lib/queries';
import { PostEditor } from '@/components/post-editor';
import { Button } from '@/components/ui/button';
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/types';

/**
 * Edit a post.
 *
 * ⚠️ Backend gap: there is NO `GET /post/:id` route — `PostService.findOneById`
 * exists but is never exposed. The only ways to read a post are
 * `GET /post/:slug` (public, published-filtered) and `GET /post/my` (author's
 * own). So we resolve the id against the author's own list.
 *
 * Consequence: an admin cannot edit someone else's post through this screen,
 * even though PATCH /post/:id would allow it (checkOwnership permits admins).
 */
export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const locale = useLocale() as Locale;
  const rtl = locale === 'fa';
  const t = useTranslations('posts');
  const tc = useTranslations('common');
  const { user } = useAuth();
  const toast = useToast();

  // Widest practical window — the endpoint has no id filter.
  const { data, isLoading, isError, refetch } = useMyPosts({ page: 1, limit: 100 });
  const deleteMut = useDeletePost();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const post = useMemo(
    () => (data?.data ?? []).find((p) => p.id === id),
    [data, id],
  );

  useEffect(() => {
    if (!isLoading && !post && !isError) {
      toast.warning(
        locale === 'fa' ? 'نوشته پیدا نشد' : 'Post not found',
        locale === 'fa'
          ? 'این نوشته در فهرست نوشته‌های شما نیست.'
          : 'This post is not in your own posts list.',
      );
    }
    // Only notify once the list has actually resolved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, post]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="p-6">
        <Alert tone="danger" title={tc('error')}>
          {locale === 'fa' ? 'دریافت نوشته‌ها ناموفق بود.' : 'Failed to load your posts.'}
        </Alert>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => void refetch()}>
          {tc('retry')}
        </Button>
      </Card>
    );
  }

  if (!post) {
    return (
      <Card>
        <EmptyState
          icon={<FileQuestion className="size-6" aria-hidden />}
          title={tc('noData')}
          description={
            locale === 'fa'
              ? 'شناسهٔ نوشته در فهرست نوشته‌های شما یافت نشد. ممکن است حذف شده باشد یا متعلق به کاربر دیگری باشد.'
              : 'This post id was not found among your own posts. It may have been deleted or belong to another user.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/dashboard/posts">
                <Button variant="secondary" size="sm">{t('backToList')}</Button>
              </Link>
              <Link href="/dashboard/posts/new">
                <Button size="sm">{t('newPost')}</Button>
              </Link>
            </div>
          }
        />
      </Card>
    );
  }

  const isOwner = post.authorId === user?.id;

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(post.id);
      toast.success(t('deletedSuccess'));
      setConfirmOpen(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.messageFor(locale, tc('error')) : String(e);
      toast.error(tc('error'), msg);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <Pencil className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold tracking-tight text-ink">
              {t('editPost')}
            </h2>
            <code dir="ltr" className="num-en block truncate font-mono text-xs text-ink-3">
              /post/{post.id}
            </code>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/posts"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:border-brand-400 hover:text-brand-600"
          >
            <ArrowRight className={cn('size-4', !rtl && 'rotate-180')} aria-hidden />
            {t('backToList')}
          </Link>
          {isOwner && (
            <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
              {tc('delete')}
            </Button>
          )}
        </div>
      </header>

      {!isOwner && (
        <Alert tone="warning" icon={<ShieldAlert className="size-4" aria-hidden />}>
          {locale === 'fa'
            ? 'شما نویسندهٔ این نوشته نیستید؛ ذخیره‌سازی ممکن است با خطای ۴۰۳ رد شود.'
            : 'You are not the author of this post; saving may be rejected with 403.'}
        </Alert>
      )}

      <PostEditor key={post.id} post={post} mode="edit" />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void onDelete()}
        loading={deleteMut.isPending}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc', { title: post.title })}
        confirmLabel={tc('delete')}
      />
    </div>
  );
}

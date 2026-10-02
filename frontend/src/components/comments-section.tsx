'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, CornerDownRight, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/toast';
import { ApiError } from '@/lib/api';
import {
  useComments, useCreateComment, useDeleteComment, useUpdateComment,
} from '@/lib/queries';
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { buildCommentTree, cn, countComments, formatRelative } from '@/lib/utils';
import type { CommentNode, Locale } from '@/lib/types';

const MAX_LEN = 1000; // matches CreateCommentDto

/**
 * GET /posts/:postId/comments returns a FLAT array (the real service loads no
 * relation besides the eager `author`), so the reply tree is assembled here.
 */
export function CommentsSection({ postId }: { postId: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('comments');
  const tc = useTranslations('common');
  const { user, isAuthenticated, isAdmin } = useAuth();
  const toast = useToast();

  const { data: flat, isLoading, isError, refetch } = useComments(postId);
  const tree = useMemo(() => buildCommentTree(flat ?? []), [flat]);
  const total = useMemo(() => countComments(tree), [tree]);

  const [replyTo, setReplyTo] = useState<CommentNode | null>(null);
  const [editing, setEditing] = useState<CommentNode | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CommentNode | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const createMut = useCreateComment(postId);
  const updateMut = useUpdateComment(postId);
  const deleteMut = useDeleteComment(postId);

  const showError = (e: unknown, fallback: string) => {
    const msg = e instanceof ApiError ? e.messageFor(locale, fallback) : fallback;
    toast.error(fallback, msg);
  };

  const startReply = (node: CommentNode) => {
    setEditing(null);
    setReplyTo(node);
    setDraft('');
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const startEdit = (node: CommentNode) => {
    setReplyTo(null);
    setEditing(node);
    setDraft(node.content);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const cancel = () => {
    setReplyTo(null);
    setEditing(null);
    setDraft('');
  };

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: { content } });
        toast.success(t('save'), t('edited'));
      } else {
        await createMut.mutateAsync({
          content,
          // Only send parentId when actually replying — ValidationPipe has
          // forbidNonWhitelisted on, so extra/undefined keys are risky.
          ...(replyTo ? { parentId: replyTo.id } : {}),
        });
        toast.success(t('submit'));
      }
      cancel();
    } catch (e) {
      showError(e, editing ? t('save') : t('submit'));
    }
  };

  const canModify = (node: CommentNode) =>
    isAuthenticated && (node.authorId === user?.id || isAdmin);

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <section aria-labelledby="comments-heading" className="mt-12">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <MessageSquare className="size-[18px]" aria-hidden />
        </span>
        <h2 id="comments-heading" className="text-xl font-bold text-ink">
          {t('title')}
          {total > 0 && (
            <span className="num-en ms-2 text-sm font-semibold text-ink-3">
              ({tc('resultsCount', { count: total }).replace(/[^\d۰-۹]/g, '') || total})
            </span>
          )}
        </h2>
      </div>

      {/* ── Composer ── */}
      <div ref={formRef} className="mt-6">
        {isAuthenticated ? (
          <div className="rounded-card border border-line bg-surface p-4">
            {(replyTo || editing) && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
                <p className="min-w-0 truncate text-xs text-ink-2">
                  {editing ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Pencil className="size-3" aria-hidden /> {t('edit')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <CornerDownRight className="size-3" aria-hidden />
                      {t('replyTo', { name: replyTo?.author?.name ?? tc('anonymous') })}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={cancel}
                  className="shrink-0 text-xs font-semibold text-ink-3 transition hover:text-rose-600"
                >
                  {t('cancelReply')}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <Avatar src={user?.avatar} name={user?.name} size="sm" className="mt-1" />
              <div className="min-w-0 flex-1">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
                  placeholder={t('placeholder')}
                  rows={3}
                  aria-label={t('writeComment')}
                  invalid={draft.length >= MAX_LEN}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={cn('num-en text-xs', draft.length >= MAX_LEN ? 'text-rose-600' : 'text-ink-3')}>
                    {draft.length}/{MAX_LEN} · {t('maxLengthHint')}
                  </span>
                  <div className="flex gap-2">
                    {(replyTo || editing) && (
                      <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
                        {t('cancel')}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => void submit()} loading={busy} disabled={!draft.trim()}>
                      {!busy && <Send className="size-3.5" aria-hidden />}
                      {editing ? t('save') : t('postComment')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface-2 p-6 text-center sm:flex-row sm:justify-between sm:text-start">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-ink-3">
                <MessageSquare className="size-4" aria-hidden />
              </span>
              <p className="text-sm text-ink-2">{t('loginRequired')}</p>
            </div>
            <Link
              href="/login"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
            >
              {t('loginCta')}
            </Link>
          </div>
        )}
      </div>

      {/* ── List ── */}
      <div className="mt-8">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<MessageSquare className="size-6" aria-hidden />}
            title={t('loadFailed')}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{tc('retry')}</Button>}
          />
        ) : tree.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-6" aria-hidden />}
            title={t('empty')}
            description={isAuthenticated ? t('emptyHint') : undefined}
          />
        ) : (
          <ul className="space-y-1">
            {tree.map((node) => (
              <CommentItem
                key={node.id}
                node={node}
                locale={locale}
                depth={0}
                canModify={canModify(node)}
                onReply={startReply}
                onEdit={startEdit}
                onDelete={setPendingDelete}
                editingId={editing?.id ?? null}
              />
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        loading={deleteMut.isPending}
        title={t('confirmDeleteTitle')}
        description={t('confirmDeleteDesc')}
        confirmLabel={tc('delete')}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteMut.mutateAsync(pendingDelete.id);
            toast.success(t('delete'));
            setPendingDelete(null);
          } catch (e) {
            showError(e, t('delete'));
            setPendingDelete(null);
          }
        }}
      />
    </section>
  );
}

function CommentItem({
  node, locale, depth, canModify, onReply, onEdit, onDelete, editingId,
}: {
  node: CommentNode;
  locale: Locale;
  depth: number;
  canModify: boolean;
  onReply: (n: CommentNode) => void;
  onEdit: (n: CommentNode) => void;
  onDelete: (n: CommentNode) => void;
  editingId: string | null;
}) {
  const t = useTranslations('comments');
  const tc = useTranslations('common');
  const isEdited = node.updatedAt !== node.createdAt;

  /** Every descendant, so the toggle can quote a true total ("12 replies")
   *  rather than just the direct children. */
  const replyTotal = useMemo(() => countComments(node.replies), [node.replies]);

  /* Notifications deep-link to `#comment-<id>`, and that id is usually a reply.
   * If the thread stays collapsed the anchor points at nothing, so any comment
   * that CONTAINS the linked one opens itself on mount. */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || replyTotal === 0) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash.startsWith('comment-')) return;
    const target = hash.slice('comment-'.length);
    const ids = new Set<string>();
    const walk = (list: CommentNode[]) => list.forEach((n) => { ids.add(n.id); walk(n.replies); });
    walk(node.replies);
    if (ids.has(target)) setOpen(true);
  }, [node.replies, replyTotal]);

  return (
    <li>
      <article
        /* Notifications deep-link to `/posts/:slug#comment-<id>`, so every
           thread node needs a stable anchor it can land on. */
        id={`comment-${node.id}`}
        className={cn(
          'group relative flex gap-3 rounded-xl p-3 transition scroll-mt-28',
          editingId === node.id && 'bg-brand-500/5 ring-1 ring-brand-500/20',
          /* Brief highlight when arriving from a notification anchor. */
          'target:ring-2 target:ring-brand-500/35 target:bg-brand-500/5',
        )}
      >
        {node.author ? (
          <Link href={`/users/${node.author.id}`} aria-label={node.author.name} className="shrink-0">
            <Avatar
              src={node.author.avatar}
              name={node.author.name}
              size="sm"
              className="mt-0.5 transition hover:opacity-85"
            />
          </Link>
        ) : (
          <Avatar name={tc('anonymous')} size="sm" className="mt-0.5" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {node.author ? (
              <Link
                href={`/users/${node.author.id}`}
                className="text-sm font-semibold text-ink transition hover:text-brand-600 dark:hover:text-brand-300"
              >
                {node.author.name}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-ink">{tc('anonymous')}</span>
            )}
            {node.author?.role === 'admin' && <Badge tone="brand">{tc('role')}</Badge>}
            <span className="num-en text-xs text-ink-3">
              {formatRelative(node.createdAt, locale)}
            </span>
            {isEdited && <span className="text-xs text-ink-3/80">· {t('edited')}</span>}
          </div>

          <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-2 break-words">
            {node.content}
          </p>

          <div className="mt-2 flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onReply(node)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-3 transition hover:bg-surface-3 hover:text-brand-600"
            >
              <CornerDownRight className="size-3.5" aria-hidden />
              {t('reply')}
            </button>
            {canModify && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(node)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-3 transition hover:bg-surface-3 hover:text-brand-600"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(node)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-3 transition hover:bg-rose-500/10 hover:text-rose-600"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  {t('delete')}
                </button>
              </>
            )}
          </div>

          {/* Replies are collapsed by default: a thread with forty replies used
              to bury every other comment on the page. The toggle reports the
              exact count so the reader knows what they are opening. */}
          {replyTotal > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={`replies-${node.id}`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-brand-600 transition hover:bg-brand-500/8 dark:text-brand-300"
              >
                <ChevronDown
                  className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')}
                  aria-hidden
                />
                {open ? t('hideReplies') : t('showReplies', { count: replyTotal })}
              </button>

              {open && (
                <ul
                  id={`replies-${node.id}`}
                  className={cn(
                    'mt-1 space-y-1 border-line ps-4',
                    // One indent guide per level keeps deep threads readable.
                    depth < 3 && 'border-s',
                  )}
                >
                  {node.replies.map((child) => (
                    <CommentItem
                      key={child.id}
                      node={child}
                      locale={locale}
                      depth={depth + 1}
                      canModify={canModify}
                      onReply={onReply}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      editingId={editingId}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </article>
    </li>
  );
}

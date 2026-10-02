'use client';

/**
 * Vertical action rail for the post detail page.
 *
 * The user asked for like / edit / share to live in a sticky column beside the
 * article instead of stacked under it, so the actions stay reachable while a
 * long post scrolls. On narrow screens the rail degrades to a single
 * horizontal row pinned under the hero — a vertical rail there would eat the
 * whole viewport.
 *
 * EDIT IS AUTHOR-ONLY. It used to read `authorId === user.id || isAdmin`, which
 * put an edit button on every post for any admin; the backend still allows
 * admins to moderate, but the UI now offers the shortcut only to the person
 * who actually wrote the piece.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Link2, Pencil, Share2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LikeButton } from '@/components/social/like-button';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import type { Post } from '@/lib/types';

export function PostActionRail({ post }: { post: Post }) {
  const t = useTranslations('posts');
  const { user, isReady } = useAuth();

  const [copied, setCopied] = useState(false);

  // Strictly the author — no admin override.
  const canEdit = isReady && !!user && user.id === post.authorId;

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement('textarea');
        el.value = url;
        el.setAttribute('readonly', '');
        el.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the visitor dismissed the share sheet — nothing to report */
    }
  };

  const railBtn =
    'group/rail flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98]';

  return (
    /* Mobile: one row. lg+: the vertical rail (the sticky wrapper lives in the page). */
    <div className="flex flex-row items-stretch gap-2 lg:flex-col">
      <div className="flex-1 lg:flex-none">
        <LikeButton
          postId={post.id}
          initialLiked={!!post.likedByMe}
          initialCount={post.likeCount ?? 0}
          variant="detail"
          className="w-full justify-between lg:justify-start"
        />
      </div>

      {canEdit && (
        <Link href={`/dashboard/posts/${post.id}/edit`} className="contents">
          <span
            role="link"
            tabIndex={0}
            title={t('editInlineHint')}
            className={cn(
              railBtn,
              'border-accent-500/45 bg-accent-500/5 text-accent-600 hover:!border-accent-500 hover:!bg-accent-500/12 dark:text-accent-300',
            )}
          >
            <Pencil className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t('editInline')}</span>
          </span>
        </Link>
      )}

      <button
        type="button"
        onClick={() => void share()}
        aria-live="polite"
        className={cn(
          railBtn,
          copied
            ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-600'
            : 'border-line-strong bg-surface text-ink-2 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-300',
        )}
      >
        {copied ? <Check className="size-4 shrink-0" aria-hidden /> : <Share2 className="size-4 shrink-0" aria-hidden />}
        <span className="truncate">{copied ? t('copied') : t('share')}</span>
        {!copied && <Link2 className="ms-auto hidden size-3.5 text-ink-3 lg:inline" aria-hidden />}
      </button>
    </div>
  );
}

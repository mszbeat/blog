'use client';

/**
 * Action bar under a post body.
 *
 * Client component because two of its three actions depend on the viewer:
 *   • the like button needs `likedByMe` + an optimistic mutation
 *   • the EDIT shortcut must only appear for the post's author or an admin —
 *     and the user asked for it to sit right next to the post so editing their
 *     own writing is one click, not a trip through the dashboard.
 *
 * The server page passes `post` down; ownership is resolved against the auth
 * context here rather than on the server, because the session is a Bearer
 * token in localStorage and is only known after hydration.
 */

import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { PostShareBar } from '@/components/post-share-bar';
import { LikeButton } from '@/components/social/like-button';
import { useAuth } from '@/lib/auth-context';
import type { Locale, Post } from '@/lib/types';

export function PostActionBar({ post, locale }: { post: Post; locale: Locale }) {
  const t = useTranslations('posts');
  const { user, isAdmin, isReady } = useAuth();

  // Mirrors the backend's checkOwnership(): the author, or any admin.
  const canEdit = isReady && !!user && (user.id === post.authorId || isAdmin);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-2.5">
        <LikeButton
          postId={post.id}
          initialLiked={!!post.likedByMe}
          initialCount={post.likeCount ?? 0}
          variant="detail"
        />

        {/* One-click edit for the owner — sits beside the post, not in a menu. */}
        {canEdit && (
          <Link href={`/dashboard/posts/${post.id}/edit`} className="contents">
            <Button
              variant="outline"
              size="md"
              className="gap-2 border-accent-500/45 text-accent-600 hover:!border-accent-500 hover:!bg-accent-500/10 dark:text-accent-300"
              title={t('editInlineHint')}
            >
              <Pencil className="size-4" aria-hidden />
              {t('editInline')}
            </Button>
          </Link>
        )}
      </div>

      <PostShareBar title={post.title} locale={locale} />
    </div>
  );
}

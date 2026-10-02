'use client';

/**
 * Client half of the public profile page.
 *
 * The server component already resolved `GET /users/:id/public` and the
 * author's posts, so first paint is complete HTML. This island exists because
 * three things are only knowable in the browser:
 *
 *   1. `isFollowing` / `isSelf` — the server fetch is unauthenticated, so it
 *      always reports false. The client re-reads the SAME endpoint with the
 *      Bearer token (optionalAuth) and the follow button lights up correctly.
 *   2. The follow mutation — optimistic, and it has to update the header
 *      counters in place.
 *   3. The active tab — shared with the header stat tiles, which act as
 *      shortcuts into the followers/following lists.
 *
 * SSR is only a first-paint placeholder; it is immediately revalidated with
 * the viewer's token because anonymous HTML cannot know follow state.
 */

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePublicProfile } from '@/lib/queries';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileTabs, type ProfileTab } from '@/components/profile/profile-tabs';
import { Card } from '@/components/ui/primitives';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Post, PublicProfile } from '@/lib/types';

export function ProfilePageClient({
  userId, initialProfile, initialPosts,
}: {
  userId: string;
  initialProfile: PublicProfile;
  initialPosts: Post[];
}) {
  const t = useTranslations('posts');
  const { user: me, isReady } = useAuth();
  const [tab, setTab] = useState<ProfileTab>('grid');

  /* Re-read with the token so follow state is real.
   *
   * `enabled` waits for the auth probe to settle — firing it while the session
   * is still resolving would cache an anonymous (isFollowing: false) answer and
   * then have to invalidate it anyway. */
  const { data } = usePublicProfile(userId, isReady, {
    initialData: initialProfile,
  });

  const profile = data ?? initialProfile;
  const user = profile.user;

  // Trust the live session over the server flag once it is known.
  const isSelf = isReady && me ? me.id === user.id : profile.isSelf;

  const posts = initialPosts;

  const onStatClick = (next: 'followers' | 'following') => setTab(next);

  return (
    <>
      <ProfileHeader
        user={user}
        stats={profile.stats}
        isFollowing={profile.isFollowing}
        isSelf={isSelf}
        onStatClick={onStatClick}
        activeStat={tab === 'followers' || tab === 'following' ? tab : null}
      />

      <div className="mt-8">
        <ProfileTabs
          user={user}
          posts={posts}
          isSelf={isSelf}
          counts={{
            likes: profile.stats.likes,
            followers: profile.stats.followers,
            following: profile.stats.following,
          }}
          tab={tab}
          onTabChange={setTab}
        />
      </div>

      {/* Zero-content state — the account exists but hasn't published. */}
      {posts.length === 0 && tab === 'grid' && (
        <Card className="mt-6 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-3 text-ink-3">
            <FileText className="size-6" aria-hidden />
          </span>
          <h2 className="text-base font-bold text-ink">{t('noPosts')}</h2>
          <p className="max-w-sm text-sm text-ink-3">{t('noPostsDesc')}</p>
        </Card>
      )}
    </>
  );
}

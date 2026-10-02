// import { BackButton } from '@/components/back-button';
import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAuthorPageData } from '@/lib/server-api';
import { ProfilePageClient } from '@/components/profile/profile-page-client';
import { ApiDownNotice } from '@/components/api-down-notice';
import { truncate } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'profile' });
  try {
    const { profile } = await getAuthorPageData(id);
    const author = profile?.user;
    if (!author) return { title: t('title') };
    return {
      title: author.name,
      description: truncate(author.bio ?? t('title'), 155),
      openGraph: {
        title: author.name,
        description: truncate(author.bio ?? '', 155),
        type: 'profile',
      },
    };
  } catch {
    return { title: t('title') };
  }
}

/**
 * Public author profile.
 *
 * Data now comes from `GET /users/:id/public` — an aggregate endpoint added to
 * the backend that returns the user, their real stats (posts / views / likes
 * received / followers / following) and the viewer's follow state in ONE call.
 *
 * That replaced the previous approach of pulling 100 posts and filtering them
 * client-side, which could not resolve a user who had published nothing and
 * had no follower counts at all.
 *
 * Server Components fetch it unauthenticated (so the HTML is crawlable and the
 * counters render immediately); the client island re-reads the same endpoint
 * with the Bearer token to light up `isFollowing` / `isSelf` for signed-in
 * visitors.
 */
export default async function UserProfilePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const t = await getTranslations('profile');

  const { profile, posts } = await getAuthorPageData(id);

  /* ── Backend unreachable ── */
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <ApiDownNotice />
        {/* <BackButton /> */}
      </div>
    );
  }

  const user = profile.user;

  return (
    <div className="pb-16">
      {/* ══════════ Back — sticky, top corner ══════════
          The coloured banner that used to carry this link is gone: profile pages
          now start on a plain surface, identical to the dashboard profile. */}
      {/* <div className="sticky top-20 z-30 mx-auto max-w-5xl px-4 pb-4 pt-5 sm:px-6">
        <BackButton />
      </div> */}

      {/* ══════════ Identity + stats + tabs ══════════ */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <ProfilePageClient
          userId={id}
          initialProfile={profile}
          initialPosts={posts}
        />
      </div>
    </div>
  );
}

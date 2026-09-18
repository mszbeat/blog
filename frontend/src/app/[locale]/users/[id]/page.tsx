import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, FileText } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getAuthorProfile } from '@/lib/server-api';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileTabs } from '@/components/profile/profile-tabs';
import { ProfileAuthFallback } from '@/components/profile/profile-auth-fallback';
import { Card } from '@/components/ui/primitives';
import { cn, gradientFor, truncate } from '@/lib/utils';
import type { Locale } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'profile' });
  try {
    const profile = await getAuthorProfile(id);
    if (!profile.author) return { title: t('title') };
    return {
      title: profile.author.name,
      description: truncate(profile.author.bio ?? t('title'), 155),
      openGraph: {
        title: profile.author.name,
        description: truncate(profile.author.bio ?? '', 155),
        type: 'profile',
      },
    };
  } catch {
    return { title: t('title') };
  }
}

export default async function UserProfilePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;
  const rtl = loc === 'fa';

  const t = await getTranslations('profile');
  const tp = await getTranslations('posts');
  const tc = await getTranslations('common');

  const profile = await getAuthorProfile(id);

  /* ── Could not resolve from public data ──
   * Either the user has no published posts, or the API is unreachable.
   * Hand off to a client component that retries with an authenticated
   * GET /users/:id (the route is behind JwtAuthGuard).
   */
  if (!profile.author) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <ProfileAuthFallback userId={id} />
      </div>
    );
  }

  const user = profile.author;

  return (
    <div className="pb-16">
      {/* ══════════ Banner ══════════ */}
      <div className="relative h-40 overflow-hidden sm:h-56">
        <div
          aria-hidden
          className={cn('absolute inset-0 bg-gradient-to-br', gradientFor(user.id + user.name))}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, #fff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-surface-2 via-surface-2/25 to-transparent"
        />

        <Link
          href="/posts"
          className={cn(
            'glass absolute top-4 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5',
            'text-sm font-semibold text-ink transition hover:border-brand-400',
          )}
          style={{ insetInlineStart: rtl ? undefined : '1rem', insetInlineEnd: rtl ? '1rem' : undefined }}
        >
          <ArrowRight className={cn('size-4', !rtl && 'rotate-180')} aria-hidden />
          {tp('backToList')}
        </Link>
      </div>

      {/* ══════════ Identity + stats + actions ══════════ */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <ProfileHeader user={user} stats={profile.stats} />

        {/* ══════════ Tabs ══════════ */}
        <div className="mt-8">
          <ProfileTabs user={user} posts={profile.posts} isSelf={false} />
        </div>

        {/* Zero-content state — the user exists but hasn't published. */}
        {profile.posts.length === 0 && (
          <Card className="mt-6 flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-3 text-ink-3">
              <FileText className="size-6" aria-hidden />
            </span>
            <h2 className="text-base font-bold text-ink">{tp('noPosts')}</h2>
            <p className="max-w-sm text-sm text-ink-3">
              {loc === 'fa'
                ? 'این کاربر هنوز نوشته‌ای منتشر نکرده است.'
                : 'This user hasn’t published anything yet.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

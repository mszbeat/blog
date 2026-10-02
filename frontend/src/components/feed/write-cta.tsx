'use client';

/**
 * The feed rail's single call-to-action.
 *
 * One slot, two honest meanings: guests are invited to JOIN, members are
 * invited to WRITE. Showing "Join us" to someone who is already signed in was
 * both useless and confusing, so the label follows the session — and nothing at
 * all is rendered until the session is known (no flash, no hydration mismatch).
 */

import { useTranslations } from 'next-intl';
import { PenSquare, UserPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth-context';

export function WriteCta() {
  const tn = useTranslations('nav');
  const ts = useTranslations('sidebar');
  const { user, isReady } = useAuth();

  if (!isReady) return null;

  const signedIn = !!user;

  return (
    <Link
      href={signedIn ? '/dashboard/posts/new' : '/register'}
      className="card card-hover flex items-center gap-3 p-4 !border-dashed"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
        {signedIn
          ? <PenSquare className="size-[18px]" aria-hidden />
          : <UserPlus className="size-[18px]" aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">
          {signedIn ? tn('newPost') : ts('joinTitle')}
        </span>
        <span className="block text-xs text-ink-3">
          {signedIn ? ts('publishFirst') : ts('joinDesc')}
        </span>
      </span>
    </Link>
  );
}

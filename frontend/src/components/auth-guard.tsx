'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Lock, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { redirect, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/lib/types';

/**
 * Client-side gate for authenticated areas.
 *
 * The backend uses Bearer tokens stored in localStorage, so the session is
 * only known after hydration — gating therefore has to happen here rather
 * than in middleware.
 *
 * @param requireAdmin additionally enforce the `admin` role (mirrors
 *        @Roles(UserRole.ADMIN) + RolesGuard on the server).
 */
export function AuthGuard({
  children, requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { status, isAuthenticated, isAdmin } = useAuth();
  const t = useTranslations('errors');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');
  const locale = useLocale() as Locale;
  const pathname = usePathname();

  // Preserve the intended destination so login can return the user to it.
  const next = encodeURIComponent(pathname);

  useEffect(() => {
    if (status === 'anonymous') {
      redirect({ href: `/login?next=${next}`, locale });
    }
  }, [status, next, locale]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-ink-3">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <p className="text-sm">{tc('loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <Lock className="size-6" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-ink">{t('unauthorized')}</h1>
        <div className="flex gap-2">
          <Link
            href={`/login?next=${next}`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
          >
            {ta('signIn')}
          </Link>
          <Button variant="secondary" onClick={() => redirect({ href: '/', locale })}>
            {t('backHome')}
          </Button>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
          <ShieldAlert className="size-6" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-ink">{t('forbidden')}</h1>
        <Button variant="secondary" onClick={() => redirect({ href: '/dashboard', locale })}>
          {tc('back')}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

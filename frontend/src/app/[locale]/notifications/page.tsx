import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AuthGuard } from '@/components/auth-guard';
import { NotificationsView } from '@/components/notifications/notifications-view';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'notifications' });
  return { title: t('pageTitle'), description: t('pageDesc') };
}

/**
 * Full notifications page.
 *
 * Server Component shell only — it pins the locale and gates on auth, then
 * hands off to the client view which owns the filters and the paginated list.
 * Gating lives in AuthGuard rather than middleware because the session is a
 * Bearer token in localStorage, so it is only known after hydration.
 */
export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AuthGuard>
      <NotificationsView />
    </AuthGuard>
  );
}

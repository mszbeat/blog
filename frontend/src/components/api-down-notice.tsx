'use client';

import { useLocale, useTranslations } from 'next-intl';
import { PlugZap } from 'lucide-react';
import { Alert } from '@/components/ui/primitives';

/**
 * Shown when the backend cannot be reached at all.
 * Lets the UI stay rendered (and demonstrable) instead of throwing.
 */
export function ApiDownNotice() {
  const t = useTranslations('errors');
  const locale = useLocale();

  return (
    <Alert
      tone="warning"
      icon={<PlugZap className="size-5" aria-hidden />}
      title={t('apiOffline')}
    >
      <p>{t('apiOfflineDesc')}</p>
      <code
        dir="ltr"
        className="mt-2 block overflow-x-auto rounded-lg bg-black/5 px-2.5 py-1.5 font-mono text-[11px] text-ink-2 dark:bg-white/5"
      >
        {locale === 'fa'
          ? 'API_ORIGIN=http://localhost:3000 npm run dev   # بک‌اند واقعی NestJS'
          : 'API_ORIGIN=http://localhost:3000 npm run dev   # real NestJS backend'}
      </code>
    </Alert>
  );
}

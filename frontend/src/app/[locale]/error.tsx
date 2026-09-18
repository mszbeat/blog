'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary.
 * Catches render/runtime errors in the public pages (e.g. the backend being
 * unreachable mid-render) and offers a retry instead of a blank screen.
 */
export default function RouteError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tc = useTranslations('common');

  // Surface the failure in the console with its digest for easier tracing.
  useEffect(() => {
    console.error('[blog-frontend]', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
        <TriangleAlert className="size-7" aria-hidden />
      </span>

      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">{t('generic')}</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-2">{t('serverError')}</p>

      {error.digest && (
        <code dir="ltr" className="num-en mt-4 rounded-lg bg-surface-3 px-2.5 py-1 font-mono text-[11px] text-ink-3">
          digest: {error.digest}
        </code>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden />
          {t('tryAgain')}
        </Button>
        <Link href="/">
          <Button variant="secondary" size="lg">{tc('back')}</Button>
        </Link>
      </div>
    </div>
  );
}

'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const LABELS: Record<string, { short: string; full: string }> = {
  fa: { short: 'فا', full: 'فارسی' },
  en: { short: 'EN', full: 'English' },
};

/**
 * Compact segmented switcher.
 * `useRouter` from our next-intl navigation keeps the current path while
 * swapping the locale prefix (and therefore <html lang>/<html dir>).
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const select = (next: string) => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next as (typeof routing.locales)[number] });
    });
  };

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        'inline-flex items-center rounded-xl border border-line-strong bg-surface-2 p-0.5',
        isPending && 'opacity-60',
        className,
      )}
    >
      <Languages className="mx-1 size-3.5 shrink-0 text-ink-3" aria-hidden />
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => select(l)}
          disabled={isPending}
          aria-pressed={l === locale}
          lang={l}
          title={LABELS[l].full}
          className={cn(
            'num-en min-w-8 rounded-lg px-2 py-1 text-xs font-bold transition',
            l === locale
              ? 'bg-surface text-brand-600 shadow-sm dark:text-brand-300'
              : 'text-ink-3 hover:text-ink',
          )}
        >
          {LABELS[l].short}
        </button>
      ))}
    </div>
  );
}

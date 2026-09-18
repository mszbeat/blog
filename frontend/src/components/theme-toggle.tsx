'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const t = useTranslations('common');
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? t('light') : t('dark')}
      title={isDark ? t('light') : t('dark')}
      className={cn(
        'relative inline-flex size-9 items-center justify-center rounded-xl border border-line-strong',
        'bg-surface-2 text-ink-2 transition hover:border-brand-400 hover:text-brand-600',
        'active:scale-95',
        className,
      )}
    >
      {/* Cross-fade the two icons instead of swapping, so the change reads smoothly. */}
      <Sun
        className={cn('absolute size-4 transition-all duration-300', isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100')}
        aria-hidden
      />
      <Moon
        className={cn('absolute size-4 transition-all duration-300', isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0')}
        aria-hidden
      />
    </button>
  );
}

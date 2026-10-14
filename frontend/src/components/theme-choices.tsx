'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Palette } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
export function ThemeChoices() {
  const { themes, colorTheme, setColorTheme, theme } = useTheme();
  const locale = useLocale() === 'fa' ? 'fa' : 'en';
  const t = useTranslations('appearance');
  return (
    <section aria-label={t('chooseTheme')}>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-ink-3">
        <Palette className="size-4" aria-hidden />
        {t('chooseTheme')}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {themes.map((preset) => (
          <button
            type="button"
            key={preset.id}
            aria-pressed={colorTheme === preset.id}
            onClick={() => setColorTheme(preset.id)}
            className={cn(
              'min-w-0 rounded-xl border p-3 text-start transition',
              colorTheme === preset.id
                ? 'border-brand-500 bg-brand-50 dark:bg-surface-3'
                : 'border-line-strong bg-surface-2 hover:border-brand-400',
            )}
          >
            <span className="mb-2 flex gap-1" aria-hidden>
              {[
                '--palette-brand-500',
                '--palette-accent-500',
                '--palette-plum-500',
                '--surface-3',
              ].map((k) => (
                <span
                  key={k}
                  className="h-5 flex-1 rounded"
                  style={{ backgroundColor: preset[theme][k] }}
                />
              ))}
            </span>
            <span className="flex items-center justify-between gap-1 text-xs font-bold text-ink">
              {preset.name[locale]}
              {colorTheme === preset.id && (
                <Check className="size-3.5" aria-hidden />
              )}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-3">{t('personalHint')}</p>
    </section>
  );
}

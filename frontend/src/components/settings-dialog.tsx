'use client';

/**
 * Settings — the single home for every global preference.
 *
 * Language and theme used to live as loose icons in the header, which both
 * cluttered the bar and caused accidents (the locale switch remounts the tree
 * and once clobbered the theme). Consolidating them here keeps the header calm
 * and gives the preferences room to be explained.
 *
 * Also owns "reduce motion", an accessibility switch with no other home.
 */

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages, Moon, MoveDiagonal, Palette as PaletteIcon, Sun, X } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { useTheme, type Theme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

const MOTION_KEY = 'blog.reduceMotion';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locale = useLocale();
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (open) setReduceMotion(localStorage.getItem(MOTION_KEY) === '1');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const applyMotion = (next: boolean) => {
    setReduceMotion(next);
    localStorage.setItem(MOTION_KEY, next ? '1' : '0');
    document.documentElement.classList.toggle('reduce-motion', next);
  };

  const pickLocale = (next: string) => {
    if (next === locale) return;
    router.replace(pathname, { locale: next as (typeof routing.locales)[number] });
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/25 animate-fade-up">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">{t('title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink"
            aria-label={tc('close')}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {/* ── Language ── */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-3">
              <Languages className="size-3.5" aria-hidden /> {t('language')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {routing.locales.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => pickLocale(l)}
                  aria-pressed={l === locale}
                  lang={l}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                    l === locale
                      ? 'satin border-transparent text-white shadow-brand'
                      : 'border-line-strong bg-surface-2 text-ink-2 hover:border-brand-400 hover:text-ink',
                  )}
                >
                  {l === 'fa' ? t('langFa') : t('langEn')}
                </button>
              ))}
            </div>
          </section>

          {/* ── Theme ── */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-3">
              <Sun className="size-3.5" aria-hidden /> {t('theme')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark'] as Theme[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTheme(m)}
                  aria-pressed={theme === m}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                    theme === m
                      ? 'satin border-transparent text-white shadow-brand'
                      : 'border-line-strong bg-surface-2 text-ink-2 hover:border-brand-400 hover:text-ink',
                  )}
                >
                  {m === 'light' ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
                  {m === 'light' ? t('light') : t('dark')}
                </button>
              ))}
            </div>
          </section>

          {/* ── Motion ─ */}
          <section>
            <button
              type="button"
              role="switch"
              aria-checked={reduceMotion}
              onClick={() => applyMotion(!reduceMotion)}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-start transition hover:border-brand-400"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <MoveDiagonal className="size-3.5 text-ink-3" aria-hidden /> {t('reduceMotion')}
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">{t('reduceMotionDesc')}</span>
              </span>
              <span
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition',
                  reduceMotion ? 'satin' : 'bg-surface-4',
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                    reduceMotion ? 'start-[1.375rem]' : 'start-0.5',
                  )}
                />
              </span>
            </button>
          </section>

          {/* ── Palette ──
              A working page, not a preference: every colour token as a live
              swatch next to its code, read straight from the COLOR CENTER in
              globals.css. Linked from here because it is a global appearance
              tool and Settings is where appearance lives. */}
          <section>
            <Link
              href="/palette"
              onClick={onClose}
              className="flex items-center justify-between gap-4 rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-start transition hover:border-brand-400"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <PaletteIcon className="size-3.5 text-ink-3" aria-hidden /> {t('palette')}
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">{t('paletteDesc')}</span>
              </span>
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

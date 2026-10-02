'use client';

/**
 * Palette explorer — every colour the site uses, as a live swatch next to its
 * token name and resolved value.
 *
 * The values are read at runtime with getComputedStyle from the COLOR CENTER in
 * globals.css, so this page can never drift out of date: change a hex there and
 * the swatch here changes with it. Swatches paint with `var(--token)` directly,
 * which means they are correct in the server-rendered HTML too; only the textual
 * value needs the browser, so it is filled in after mount (no hydration risk).
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';

type Group = { key: string; tokens: string[] };

const GROUPS: Group[] = [
  {
    key: 'brand',
    tokens: [
      '--color-brand-50', '--color-brand-100', '--color-brand-200', '--color-brand-300',
      '--color-brand-400', '--color-brand-500', '--color-brand-600', '--color-brand-700',
      '--color-brand-800', '--color-brand-900',
    ],
  },
  { key: 'accent', tokens: ['--color-accent-300', '--color-accent-400', '--color-accent-500', '--color-accent-600'] },
  { key: 'plum', tokens: ['--color-plum-300', '--color-plum-400', '--color-plum-500', '--color-plum-600'] },
  {
    key: 'semantic',
    tokens: [
      '--color-danger-500', '--color-danger-600', '--color-success-500',
      '--color-warning-500', '--color-info-500',
    ],
  },
  { key: 'surface', tokens: ['--surface', '--surface-2', '--surface-3', '--surface-4'] },
  { key: 'ink', tokens: ['--ink', '--ink-2', '--ink-3', '--ink-4'] },
  { key: 'line', tokens: ['--line', '--line-strong'] },
  { key: 'extra', tokens: ['--on-brand', '--sheen'] },
];

/** Gradient recipes — shown as real tiles, because a hex cannot describe them. */
const RECIPES: { name: string; cls: string; varName?: string }[] = [
  { name: '.satin', cls: 'satin', varName: '--grad-satin' },
  { name: '.text-gradient', cls: 'text-gradient', varName: '--grad-text' },
  { name: '.bg-mesh', cls: 'bg-mesh', varName: '--grad-mesh' },
  { name: '.bg-grid', cls: 'bg-grid', varName: '--grad-grid' },
  { name: '.glass', cls: 'glass', varName: '--glass-bg' },
  { name: '.grad-fade', cls: '', varName: '--grad-fade' },
  { name: '.grad-logo', cls: '', varName: '--grad-logo' },
];

const COVERS = ['grad-1', 'grad-2', 'grad-3', 'grad-4', 'grad-5', 'grad-6'];
/* Literal class names: Tailwind can only see classes that exist verbatim in
   the source, so `shadow-${x}` would compile to nothing. */
const SHADOWS = [
  { name: 'elev-1', cls: 'shadow-elev-1' },
  { name: 'elev-2', cls: 'shadow-elev-2' },
  { name: 'elev-3', cls: 'shadow-elev-3' },
];

/* Hoisted out of the component body: defining a row component inside render
   gives React a new element type every time, which remounts each swatch on
   every parent update. */
function SwatchRow({
  token, value, copied, copyLabel, onCopy,
}: {
  token: string;
  value: string;
  copied: boolean;
  copyLabel: string;
  onCopy: (value: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
      {/* The swatch paints straight from the token, so it is already correct in
          the server-rendered HTML — only the text value needs the browser. */}
      <span
        className="size-10 shrink-0 rounded-lg ring-1 ring-inset ring-line-strong"
        style={{ background: `var(${token})` }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="num-en block truncate text-xs font-bold text-ink" dir="ltr">{token}</span>
        <button
          type="button"
          onClick={() => onCopy(value)}
          title={copyLabel}
          className="num-en mt-0.5 flex max-w-full items-center gap-1 truncate text-[11px] text-ink-3 transition hover:text-brand-600"
          dir="ltr"
        >
          {copied
            ? <Check className="size-3 shrink-0 text-brand-600" aria-hidden />
            : <Copy className="size-3 shrink-0" aria-hidden />}
          <span className="truncate">{value || '—'}</span>
        </button>
      </span>
    </li>
  );
}

export function PaletteExplorer() {
  const t = useTranslations('palette');
  const { theme, setTheme } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  /* Re-read whenever the theme flips: `.dark` overrides several recipes. */
  const read = useCallback(() => {
    const cs = getComputedStyle(document.documentElement);
    const names = [
      ...GROUPS.flatMap((g) => g.tokens),
      ...RECIPES.map((r) => r.varName).filter((v): v is string => !!v),
      ...COVERS.flatMap((c) => [`--${c}-from`, `--${c}-to`]),
    ];
    const next: Record<string, string> = {};
    for (const n of names) next[n] = cs.getPropertyValue(n).trim().replace(/\s+/g, ' ');
    setValues(next);
  }, []);

  useEffect(() => { read(); }, [read, theme]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1400);
    } catch { /* clipboard unavailable — the value is still selectable */ }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">{t('subtitle')}</p>
        </div>

        {/* Theme switch, so both palettes can be compared without leaving. */}
        <div className="flex items-center gap-1 rounded-xl border border-line-strong bg-surface p-1" role="group" aria-label={t('theme')}>
          {(['light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              aria-pressed={theme === mode}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition',
                theme === mode ? 'satin text-white shadow-brand' : 'text-ink-3 hover:text-ink',
              )}
            >
              {mode === 'light' ? <Sun className="size-3.5" aria-hidden /> : <Moon className="size-3.5" aria-hidden />}
              {t(mode)}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-dashed border-line-strong bg-surface-2 p-3.5 text-xs leading-relaxed text-ink-3">
        {t('hint')}
      </p>

      {/* ── Ramps ── */}
      <div className="mt-8 space-y-8">
        {GROUPS.map((g) => (
          <section key={g.key}>
            <h2 className="text-sm font-extrabold text-ink">{t(`groups.${g.key}`)}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.tokens.map((token) => (
                <SwatchRow
                  key={token}
                  token={token}
                  value={values[token] ?? ''}
                  copied={copied === (values[token] ?? '')}
                  copyLabel={t('copy')}
                  onCopy={copy}
                />
              ))}
            </ul>
          </section>
        ))}

        {/* ── Recipes ── */}
        <section>
          <h2 className="text-sm font-extrabold text-ink">{t('groups.recipe')}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RECIPES.map((r) => (
              <div key={r.name} className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className={cn('h-20 w-full', r.cls)} style={r.cls ? undefined : { background: `var(${r.varName})` }} aria-hidden />
                <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                  <span className="num-en truncate text-xs font-bold text-ink" dir="ltr">{r.name}</span>
                  <span className="num-en truncate text-[10px] text-ink-4" dir="ltr">{r.varName}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Cover gradients ── */}
        <section>
          <h2 className="text-sm font-extrabold text-ink">{t('groups.cover')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {COVERS.map((c) => (
              <div key={c} className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className={cn('h-16 w-full', c)} aria-hidden />
                <div className="border-t border-line px-2 py-1.5">
                  <span className="num-en block text-[11px] font-bold text-ink" dir="ltr">.{c}</span>
                  <span className="num-en block truncate text-[10px] text-ink-4" dir="ltr">
                    {values[`--${c}-from`] ?? '—'} → {values[`--${c}-to`] ?? '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Shadows ── */}
        <section>
          <h2 className="text-sm font-extrabold text-ink">{t('groups.shadow')}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {SHADOWS.map((s) => (
              <div key={s.name} className={cn('rounded-xl border border-line bg-surface p-5', s.cls)}>
                <span className="num-en text-xs font-bold text-ink" dir="ltr">.shadow-{s.name}</span>
              </div>
            ))}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-brand">
              <span className="num-en text-xs font-bold text-ink" dir="ltr">.shadow-brand</span>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5 shadow-plum">
              <span className="num-en text-xs font-bold text-ink" dir="ltr">.shadow-plum</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

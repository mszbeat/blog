'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Check,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { api, ApiError } from '@/lib/api';
import {
  COLOR_HEX,
  COLOR_KEYS,
  DEFAULT_THEMES,
  type SiteTheme,
  type ThemeMode,
} from '@/lib/site-themes';
import { cn } from '@/lib/utils';

function group(key: string) {
  if (key.includes('palette-brand')) return 'brand';
  if (key.includes('palette-accent')) return 'accent';
  if (key.includes('palette-plum')) return 'plum';
  if (key.startsWith('--palette-')) return 'semantic';
  if (key.startsWith('--grad-')) return 'gradient';
  if (key.startsWith('--shadow-')) return 'shadow';
  return 'neutral';
}
const groups = [
  'all',
  'brand',
  'accent',
  'plum',
  'neutral',
  'semantic',
  'gradient',
  'shadow',
];
const button =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40';
const clone = (value: SiteTheme): SiteTheme => ({
  ...value,
  light: { ...value.light },
  dark: { ...value.dark },
});
export function ThemeStudio() {
  const { themes, catalogReady, catalogError, refreshThemes, colorTheme } =
    useTheme();
  const [selected, setSelected] = useState(colorTheme);
  const [dirty, setDirty] = useState(false);
  const t = useTranslations('appearance');
  const locale = useLocale() === 'fa' ? 'fa' : 'en';
  if (!catalogReady)
    return (
      <div
        role={catalogError ? 'alert' : 'status'}
        className="rounded-2xl border border-line bg-surface p-8 text-center text-ink-2"
      >
        <p>{t(catalogError ? 'loadError' : 'loading')}</p>
        {catalogError && (
          <button
            type="button"
            className={cn(button, 'mt-4')}
            onClick={() => void refreshThemes()}
          >
            {t('retry')}
          </button>
        )}
      </div>
    );
  return (
    <div className="space-y-6" data-testid="theme-studio">
      <header className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:bg-surface-3 dark:text-brand-300">
          <ShieldCheck className="size-3.5" />
          {t('adminOnly')}
        </span>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold text-ink">
          <Palette className="size-6 text-brand-500" />
          {t('title')}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
          {t('subtitle')}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {themes.map((preset) => (
          <button
            data-testid={`edit-theme-${preset.id}`}
            type="button"
            key={preset.id}
            aria-pressed={selected === preset.id}
            onClick={() => {
              if (selected === preset.id) return;
              if (dirty && !window.confirm(t('switchConfirm'))) return;
              setDirty(false);
              setSelected(preset.id);
            }}
            className={cn(
              'min-w-0 overflow-hidden rounded-2xl border text-start transition hover:-translate-y-0.5',
              selected === preset.id
                ? 'border-brand-500 ring-2 ring-brand-500/20'
                : 'border-line-strong',
            )}
          >
            <span className="flex h-20" aria-hidden>
              {(['light', 'dark'] as const).map((mode) => (
                <span
                  key={mode}
                  className="flex w-1/2 items-center justify-center gap-1 p-2"
                  style={{ background: preset[mode]['--surface-2'] }}
                >
                  <span
                    className="size-5 rounded-full"
                    style={{ background: preset[mode]['--palette-brand-500'] }}
                  />
                  <span
                    className="size-3 rounded-full"
                    style={{ background: preset[mode]['--palette-accent-500'] }}
                  />
                </span>
              ))}
            </span>
            <span className="block bg-surface p-3">
              <span className="flex items-center justify-between gap-1 text-sm font-bold text-ink">
                {preset.name[locale]}
                {selected === preset.id && (
                  <Check className="size-4 shrink-0 text-brand-500" />
                )}
              </span>
              <span className="mt-1 block text-[11px] text-ink-3">
                {preset.description[locale]}
              </span>
            </span>
          </button>
        ))}
      </div>
      <ThemeForm
        key={selected}
        initial={themes.find((t) => t.id === selected)!}
        onDirty={setDirty}
      />
    </div>
  );
}
function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const rgb = [1, 3, 5]
      .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function ThemeForm({
  initial,
  onDirty,
}: {
  initial: SiteTheme;
  onDirty: (v: boolean) => void;
}) {
  const { publishTheme, refreshThemes, theme } = useTheme();
  const t = useTranslations('appearance');
  const locale = useLocale() === 'fa' ? 'fa' : 'en';
  const [draft, setDraft] = useState(() => clone(initial));
  const [mode, setMode] = useState<ThemeMode>(theme);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) setDraft(clone(initial));
  }, [initial, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const setColor = (key: string, value: string) => {
    setDirty(true);
    setSaved(false);
    setDraft((d) => ({ ...d, [mode]: { ...d[mode], [key]: value } }));
  };
  const invalid = (['light', 'dark'] as const).some((m) =>
    COLOR_KEYS.some((k) => !COLOR_HEX.test(draft[m][k])),
  );
  const colors = draft[mode];
  const safe = (k: string) =>
    COLOR_HEX.test(colors[k]) ? colors[k] : initial[mode][k];
  const ratio = contrast(safe('--ink'), safe('--surface'));
  const visible = COLOR_KEYS.filter(
    (k) =>
      (filter === 'all' || group(k) === filter) &&
      k.toLowerCase().includes(search.toLowerCase()),
  );
  const save = async () => {
    if (invalid || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await api.updateTheme(draft);
      await publishTheme(result);
      setDraft(clone(result));
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.messageFor(locale) : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-ink">
          {t('editTheme', { name: initial.name[locale] })}
        </h3>
        <div className="flex gap-1 rounded-xl bg-surface-3 p-1">
          {(['light', 'dark'] as const).map((m) => (
            <button
              type="button"
              key={m}
              data-testid={`edit-mode-${m}`}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-lg px-4 py-2 text-xs font-bold',
                mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-3',
              )}
            >
              {t(m)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-3">{t('modeHint')}</p>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <section className="min-w-0 rounded-2xl border border-line bg-surface p-4">
          <label className="mb-3 flex items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3">
            <Search className="size-4 shrink-0 text-ink-3" />
            <input
              aria-label={t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-ink outline-none"
            />
          </label>
          <div className="mb-4 flex flex-wrap gap-1">
            {groups.map((g) => (
              <button
                type="button"
                key={g}
                aria-pressed={filter === g}
                onClick={() => setFilter(g)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold',
                  filter === g
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-2 text-ink-3 hover:bg-surface-3',
                )}
              >
                {t(g)}
              </button>
            ))}
          </div>
          <p className="mb-4 text-xs text-ink-3">{t('hexHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {visible.map((key) => (
              <label
                key={key}
                className="min-w-0 rounded-xl border border-line bg-surface-2 p-3"
              >
                <span
                  title={key}
                  dir="ltr"
                  className="mb-2 block truncate font-mono text-[10px] text-ink-3"
                >
                  {key}
                </span>
                <span className="flex min-w-0 items-center gap-2" dir="ltr">
                  <input
                    disabled={saving}
                    aria-label={`${key} picker`}
                    type="color"
                    value={safe(key).slice(0, 7)}
                    onChange={(e) =>
                      setColor(
                        key,
                        e.target.value +
                          (colors[key].length === 9
                            ? colors[key].slice(7)
                            : ''),
                      )
                    }
                    className="h-9 w-10 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <input
                    disabled={saving}
                    aria-label={key}
                    spellCheck={false}
                    value={colors[key]}
                    maxLength={9}
                    onChange={(e) => setColor(key, e.target.value)}
                    aria-invalid={!COLOR_HEX.test(colors[key])}
                    className="min-w-0 w-full rounded-lg border border-line-strong bg-surface p-2 font-mono text-xs text-ink outline-none focus:border-brand-500 aria-invalid:border-danger-500"
                  />
                </span>
              </label>
            ))}
          </div>
          {!visible.length && (
            <p className="p-5 text-sm text-ink-3">{t('noResults')}</p>
          )}
        </section>
        <aside className="order-first space-y-3 xl:order-last xl:sticky xl:top-24">
          <h4 className="flex items-center gap-2 text-xs font-bold text-ink-3">
            <Sparkles className="size-4" />
            {t('preview')}
          </h4>
          <div
            data-testid="theme-preview"
            className="overflow-hidden rounded-2xl border p-4"
            style={{
              background: safe('--surface-2'),
              borderColor: safe('--line'),
              color: safe('--ink'),
            }}
          >
            <div
              className="mb-5 flex items-center justify-between border-b pb-3"
              style={{ borderColor: safe('--line') }}
            >
              <span
                className="text-xl font-black"
                style={{ color: safe('--palette-brand-600') }}
              >
                Z<span className="text-sm">log</span>
              </span>
              <span
                className="h-2 w-12 rounded-full"
                style={{ background: safe('--surface-4') }}
              />
            </div>
            <div
              className="mb-3 h-20 rounded-xl"
              style={{
                background: `linear-gradient(125deg, ${safe('--palette-brand-500')}, ${safe('--palette-plum-500')})`,
              }}
            />
            <article
              className="rounded-xl border p-4"
              style={{
                background: safe('--surface'),
                borderColor: safe('--line'),
              }}
            >
              <span
                className="text-[10px] font-bold"
                style={{ color: safe('--palette-accent-600') }}
              >
                ZLOG JOURNAL
              </span>
              <h5 className="my-2 text-base font-bold">{t('previewTitle')}</h5>
              <p
                className="text-xs leading-relaxed"
                style={{ color: safe('--ink-2') }}
              >
                {t('previewText')}
              </p>
              <span
                className="mt-4 block rounded-lg px-2 py-2 text-center text-xs font-bold"
                style={{
                  background: safe('--palette-brand-600'),
                  color: safe('--on-brand'),
                }}
              >
                {t('previewButton')}
              </span>
            </article>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 text-xs text-ink-3">
            <div className="flex justify-between gap-2">
              <span>{t('contrast')}</span>
              <b
                dir="ltr"
                className={ratio < 4.5 ? 'text-danger-600' : 'text-brand-600'}
              >
                {ratio.toFixed(2)} : 1
              </b>
            </div>
            {ratio < 4.5 && <p className="mt-2">{t('contrastWarning')}</p>}
          </div>
          <button
            type="button"
            className={cn(button, 'w-full')}
            disabled={saving}
            onClick={() => {
              if (window.confirm(t('resetConfirm'))) {
                setDraft((d) => ({
                  ...d,
                  [mode]: {
                    ...DEFAULT_THEMES.find((t) => t.id === d.id)![mode],
                  },
                }));
                setDirty(true);
                setSaved(false);
              }
            }}
          >
            <RotateCcw className="size-3.5" />
            {t('reset')}
          </button>
          <p className="text-xs leading-relaxed text-ink-3">
            {t('publishedHint')}
          </p>
        </aside>
      </div>
      <div className="sticky bottom-20 z-20 rounded-2xl border border-line-strong bg-surface/95 p-3 shadow-xl backdrop-blur-xl sm:bottom-24">
        {invalid && (
          <p role="alert" className="mb-2 text-xs text-danger-600">
            {t('invalid')}
          </p>
        )}
        {error && (
          <div role="alert" className="mb-3 text-sm text-danger-600">
            <p>{error}</p>
            <button
              type="button"
              disabled={saving}
              className={cn(button, 'mt-2')}
              onClick={async () => {
                const data = await refreshThemes();
                const fresh = data?.find((t) => t.id === initial.id);
                if (fresh) {
                  setDirty(false);
                  setDraft(clone(fresh));
                  setError('');
                }
              }}
            >
              {t('reload')}
            </button>
          </div>
        )}
        {saved && (
          <p role="status" className="mb-2 text-xs text-brand-600">
            {t('saved')}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-ink-3">
            {dirty ? t('unsaved') : initial.name[locale]}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(clone(initial));
                setDirty(false);
                setError('');
                setSaved(false);
              }}
            >
              {t('discard')}
            </button>
            <button
              type="button"
              data-testid="publish-theme"
              disabled={!dirty || invalid || saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
              onClick={() => void save()}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {t(saving ? 'saving' : 'save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

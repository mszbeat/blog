'use client';

import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bold, Italic, Strikethrough, Heading2, List, ListOrdered, Quote, Code, Link as LinkIcon, Smile, Undo2, Redo2, Eye, Pencil, Minus } from 'lucide-react';
import { Textarea } from '@/components/ui/form';
import { PostBody } from '@/components/post-body';

const EMOJI = ['😀', '😊', '😍', '🤔', '😎', '😂', '🎉', '✨', '🔥', '💡', '❤️', '👍', '🙏', '🌱', '🚀', '📚', '✅', '💻'];
type Props = { id: string; value: string; onChange: (value: string) => void; onBlur?: () => void; invalid?: boolean; placeholder?: string };
type Snapshot = { text: string; start: number; end: number };

/** Small Markdown editor: no free-form HTML, fonts or arbitrary style markup. */
export const MarkdownEditor = forwardRef<HTMLTextAreaElement, Props>(function MarkdownEditor(
  { id, value, onChange, onBlur, invalid, placeholder }, forwardedRef,
) {
  const t = useTranslations('editor');
  const input = useRef<HTMLTextAreaElement | null>(null);
  const selection = useRef({ start: 0, end: 0 });
  const history = useRef<{ undo: Snapshot[]; redo: Snapshot[] }>({ undo: [], redo: [] });
  const [preview, setPreview] = useState(false);
  const [panel, setPanel] = useState<'emoji' | 'link' | null>(null);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [, repaint] = useState(0);

  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const next = pendingSelection.current;
    if (!next) return;
    pendingSelection.current = null;
    input.current?.focus();
    input.current?.setSelectionRange(next.start, next.end);
  });

  const snapshot = (): Snapshot => ({ text: value, ...selection.current });
  const restore = (state: Snapshot) => {
    onChange(state.text);
    selection.current = { start: state.start, end: state.end };
    pendingSelection.current = { start: state.start, end: state.end };
    repaint(n => n + 1);
  };
  const change = (text: string, start: number, end = start) => {
    history.current.undo.push(snapshot());
    history.current.undo = history.current.undo.slice(-100);
    history.current.redo = [];
    restore({ text, start, end });
  };
  const undo = () => {
    const prev = history.current.undo.pop();
    if (prev) { history.current.redo.push(snapshot()); restore(prev); }
  };
  const redo = () => {
    const next = history.current.redo.pop();
    if (next) { history.current.undo.push(snapshot()); restore(next); }
  };
  const insert = (text: string) => {
    const { start, end } = selection.current;
    change(value.slice(0, start) + text + value.slice(end), start + text.length);
  };
  const wrap = (mark: string) => {
    const { start, end } = selection.current;
    const text = value.slice(start, end) || t('sampleText');
    change(value.slice(0, start) + mark + text + mark + value.slice(end), start + mark.length, start + mark.length + text.length);
  };
  const lines = (prefix: string | ((i: number) => string)) => {
    const { start, end } = selection.current;
    const a = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const b = lineEnd === -1 ? value.length : lineEnd;
    const text = (value.slice(a, b) || t('sampleText')).split('\n').map((line, i) => (typeof prefix === 'string' ? prefix : prefix(i)) + line).join('\n');
    change(value.slice(0, a) + text + value.slice(b), a, a + text.length);
  };
  const addLink = () => {
    try {
      const parsed = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      const label = (value.slice(selection.current.start, selection.current.end) || t('linkText')).replace(/[\[\]\\]/g, '\\$&');
      const href = parsed.href.replace(/\(/g, '%28').replace(/\)/g, '%29');
      insert(`[${label}](${href})`);
      setPanel(null); setUrl(''); setLinkError(false);
    } catch { setLinkError(true); }
  };
  const tools = [
    { label: t('bold'), icon: Bold, action: () => wrap('**') },
    { label: t('italic'), icon: Italic, action: () => wrap('*') },
    { label: t('strike'), icon: Strikethrough, action: () => wrap('~~') },
    { label: t('heading'), icon: Heading2, action: () => lines('# ') },
    { label: t('bulletList'), icon: List, action: () => lines('- ') },
    { label: t('numberList'), icon: ListOrdered, action: () => lines(i => `${i + 1}. `) },
    { label: t('quote'), icon: Quote, action: () => lines('> ') },
    { label: t('code'), icon: Code, action: () => wrap('`') },
    { label: t('divider'), icon: Minus, action: () => insert('\n\n---\n\n') },
  ];
  const buttonClass = 'inline-flex size-9 items-center justify-center rounded-lg text-ink-2 transition hover:bg-surface-3 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-40';

  return (
    <div className="overflow-hidden rounded-xl border border-line-strong bg-surface" onKeyDown={e => { if (e.key === 'Escape') { setPanel(null); input.current?.focus(); } }}>
      <div role="group" aria-label={t('tools')} className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-2 p-2">
        {tools.map(({ label, icon: Icon, action }) => (
          <button key={label} type="button" title={label} aria-label={label} disabled={preview} className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={action}><Icon className="size-4" aria-hidden /></button>
        ))}
        <button type="button" aria-label={t('link')} title={t('link')} aria-expanded={panel === 'link'} disabled={preview} className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={() => { setPanel(panel === 'link' ? null : 'link'); setLinkError(false); }}><LinkIcon className="size-4" aria-hidden /></button>
        <button type="button" aria-label={t('emoji')} title={t('emoji')} aria-expanded={panel === 'emoji'} disabled={preview} className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}><Smile className="size-4" aria-hidden /></button>
        <button type="button" aria-label={t('undo')} title={t('undo')} disabled={preview || !history.current.undo.length} className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={undo}><Undo2 className="size-4" aria-hidden /></button>
        <button type="button" aria-label={t('redo')} title={t('redo')} disabled={preview || !history.current.redo.length} className={buttonClass} onMouseDown={e => e.preventDefault()} onClick={redo}><Redo2 className="size-4" aria-hidden /></button>
        <button type="button" className="ms-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-brand-600 hover:bg-surface-3" aria-pressed={preview} onClick={() => { setPreview(!preview); setPanel(null); }}>
          {preview ? <Pencil className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}{preview ? t('write') : t('preview')}
        </button>
      </div>
      {panel === 'emoji' && <div role="group" aria-label={t('emoji')} className="flex flex-wrap gap-1 border-b border-line p-2">{EMOJI.map(emoji => <button key={emoji} type="button" aria-label={emoji} className="size-10 rounded-lg text-xl hover:bg-surface-3" onMouseDown={e => e.preventDefault()} onClick={() => { insert(emoji); setPanel(null); }}>{emoji}</button>)}</div>}
      {panel === 'link' && <div className="space-y-2 border-b border-line p-3">
        <label className="block text-sm text-ink" htmlFor={`${id}-link`}>{t('linkUrl')}</label>
        <div className="flex flex-wrap gap-2"><input id={`${id}-link`} type="url" dir="ltr" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="min-w-0 flex-1 rounded-lg border border-line bg-surface p-2 text-sm text-ink" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} /><button type="button" className="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white" onClick={addLink}>{t('insertLink')}</button></div>
        {linkError && <p role="alert" className="text-xs text-danger-600">{t('invalidUrl')}</p>}
      </div>}
      {/* Keep the textarea mounted so focus, selection and RHF ref remain stable. */}
      <div hidden={preview}>
        <Textarea id={id} name="content" rows={16} value={value} invalid={invalid} placeholder={placeholder} className="!rounded-none !border-0 !bg-transparent text-base leading-loose focus:!ring-0"
          ref={el => { input.current = el; if (typeof forwardedRef === 'function') forwardedRef(el); else if (forwardedRef) forwardedRef.current = el; }}
          aria-describedby={`${id}-help`} onBlur={onBlur}
          onSelect={e => { selection.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
          onChange={e => { history.current.undo.push(snapshot()); history.current.undo = history.current.undo.slice(-100); history.current.redo = []; selection.current = { start: e.target.selectionStart, end: e.target.selectionEnd }; onChange(e.target.value); }}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing || !(e.ctrlKey || e.metaKey)) return;
            const key = e.key.toLowerCase();
            if (key === 'b' || key === 'i') { e.preventDefault(); wrap(key === 'b' ? '**' : '*'); }
            if (key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
            if (key === 'y') { e.preventDefault(); redo(); }
          }}
        />
      </div>
      {preview && <div role="region" aria-label={t('preview')} className="min-h-72 p-4">{value.trim() ? <PostBody content={value} /> : <p className="text-sm text-ink-3">{t('emptyPreview')}</p>}</div>}
      <p id={`${id}-help`} className="border-t border-line px-3 py-2 text-xs text-ink-3">{t('hint')}</p>
    </div>
  );
});

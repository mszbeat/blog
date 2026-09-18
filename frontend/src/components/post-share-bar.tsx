'use client';

import { useEffect, useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/types';

/**
 * Copy-to-clipboard share control.
 * Falls back to a manual prompt when the async Clipboard API is unavailable
 * (non-HTTPS contexts, some embedded browsers).
 */
export function PostShareBar({ title, locale }: { title: string; locale: Locale }) {
  const t = useTranslations('posts');
  const [copied, setCopied] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const share = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (supported && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      if (supported) {
        await navigator.clipboard.writeText(url);
      } else {
        // Legacy fallback.
        const el = document.createElement('textarea');
        el.value = url;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
    } catch {
      /* user dismissed the share sheet — nothing to report */
    }
  };

  return (
    <div className="mt-10 flex items-center justify-between gap-4 rounded-card border border-line bg-surface-2 p-4">
      <p className="min-w-0 truncate text-sm text-ink-3">
        {locale === 'fa' ? 'این نوشته را با دیگران به اشتراک بگذارید' : 'Share this post with others'}
      </p>
      <button
        type="button"
        onClick={() => void share()}
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition active:scale-[0.98]',
          copied
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
            : 'border-line-strong bg-surface text-ink-2 hover:border-brand-500 hover:text-brand-600',
        )}
        aria-live="polite"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
        {copied ? t('copied') : t('share')}
        {!copied && <Link2 className="hidden size-3.5 text-ink-3 sm:inline" aria-hidden />}
      </button>
    </div>
  );
}

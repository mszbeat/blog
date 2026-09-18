'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Link2, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'iconSm';

/* Mirrors Button's VARIANTS/SIZES so a ShareButton can sit next to a Button
 * and look like it came from the same set. */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700',
  secondary: 'bg-surface-3 text-ink border border-line hover:bg-line-strong',
  ghost: 'text-ink-2 hover:bg-surface-3 hover:text-ink',
  outline: 'border border-line-strong bg-transparent text-ink hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-300',
  subtle: 'bg-brand-500/10 text-brand-700 hover:bg-brand-500/20 dark:text-brand-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
  icon: 'size-10 justify-center',
  iconSm: 'size-8 justify-center',
};

/**
 * Share / copy-link control.
 *
 * Prefers the native Web Share API (mobile sheets, desktop share dialogs) and
 * falls back to the clipboard, with a legacy `execCommand` path for non-secure
 * contexts (plain http on a LAN IP, where navigator.clipboard is undefined).
 *
 * Rendered as a <button> so it can live inside a feed action bar or a card
 * header without nesting interactive elements.
 */
export function ShareButton({
  title, url, label, className, variant = 'ghost', size = 'md', showIcon = true, children,
}: {
  /** Text handed to navigator.share; also used as the accessible name. */
  title?: string;
  /** Absolute or path URL. Defaults to the current page URL. */
  url?: string;
  /** Visible text. Defaults to the translated "Share". */
  label?: string;
  className?: string;
  variant?: Variant;
  size?: Size;
  showIcon?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const [canClipboard, setCanClipboard] = useState(false);

  useEffect(() => {
    setCanClipboard(typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const onClick = async (e: React.MouseEvent) => {
    // Don't let a wrapping <Link>/card click fire as well.
    e.preventDefault();
    e.stopPropagation();

    const target = url ?? (typeof window !== 'undefined' ? window.location.href : '');
    const shareTitle = title ?? label ?? t('share') ?? 'Share';

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: shareTitle, url: target });
        return;
      }
      if (canClipboard) {
        await navigator.clipboard.writeText(target);
      } else {
        const el = document.createElement('textarea');
        el.value = target;
        el.setAttribute('readonly', '');
        el.style.cssText = 'position:fixed;top:0;opacity:0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
    } catch {
      /* The user dismissed the share sheet — nothing to report. */
    }
  };

  const text = label ?? t('share') ?? 'Share';
  const Icon = copied ? Check : showIcon ? Share2 : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex select-none items-center rounded-xl font-semibold',
        'transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.985]',
        VARIANTS[variant],
        SIZES[size],
        copied && '!text-emerald-600 dark:!text-emerald-400',
        className,
      )}
      aria-label={text}
      title={copied ? (t('copied') ?? 'Copied') : text}
    >
      {Icon && (
        <Icon
          className={cn('size-4', size === 'lg' && 'size-[18px]', copied && 'animate-pop')}
          aria-hidden
        />
      )}
      {children}
      {/* Icon-only sizes stay icon-only so the control never grows lopsided. */}
      {size !== 'icon' && size !== 'iconSm' && (
        <span className="inline-flex items-center gap-1">
          {copied ? <Link2 className="size-3.5" aria-hidden /> : null}
          {copied ? (t('copied') ?? 'Copied!') : text}
        </span>
      )}
    </button>
  );
}

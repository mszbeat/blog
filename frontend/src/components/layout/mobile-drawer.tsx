'use client';

/**
 * Mobile navigation drawer.
 *
 * Slides in from the inline-END edge (the side the menu button sits on) and
 * stops at half the viewport width, so the page stays visible beside it and a
 * tap on that visible area closes it — the same affordance as iOS sheets.
 * An explicit X is provided too, and Escape works for keyboards.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export function MobileDrawer({
  open, onClose, children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tc = useTranslations('common');

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

  return (
    <div
      className={cn('fixed inset-0 z-[130] md:hidden', !open && 'pointer-events-none')}
      aria-hidden={!open}
    >
      {/* Backdrop — tap outside to dismiss. */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-slate-950/55 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
      />

      {/* Panel — half the screen, sliding from the end edge. */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute inset-y-0 end-0 flex w-1/2 min-w-[13.5rem] flex-col border-s border-line bg-surface shadow-2xl shadow-black/30',
          'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          open ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-ink-3">
            {tc('appName')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink"
            aria-label={tc('close')}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5">{children}</div>
      </div>
    </div>
  );
}

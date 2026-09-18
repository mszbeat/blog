'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Lightweight modal (no external dependency).
 * Closes on Escape / backdrop click, traps focus on the confirm button and
 * restores focus to the trigger afterwards.
 */
export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel, cancelLabel,
  tone = 'danger', loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  const t = useTranslations('common');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    // Defer so the element is mounted before focusing.
    const id = requestAnimationFrame(() => confirmRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        // Keep focus cycling inside the dialog.
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>('[data-confirm-dialog] button'),
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      data-confirm-dialog
    >
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-fade-in"
        onClick={loading ? undefined : onClose}
        aria-hidden
      />
      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl shadow-black/20',
          'animate-fade-up',
        )}
      >
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              tone === 'danger' ? 'bg-rose-500/12 text-rose-600' : 'bg-brand-500/12 text-brand-600',
            )}
          >
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-bold text-ink">{title}</h2>
            {description && (
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{description}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2 sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1 sm:flex-none">
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            className="flex-1 sm:flex-none"
          >
            {confirmLabel ?? t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}

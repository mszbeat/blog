'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

/* ───────────────────────── Field wrapper ───────────────────────── */

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label, hint, error, required, optionalLabel, htmlFor, children, className,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-baseline gap-1.5 text-sm font-medium text-ink"
        >
          <span>{label}</span>
          {required && <span className="text-rose-500" aria-hidden>*</span>}
          {!required && optionalLabel && (
            <span className="text-xs font-normal text-ink-3">({optionalLabel})</span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

/* ───────────────────────── shared control styles ───────────────────────── */

const CONTROL = cn(
  'w-full rounded-xl border bg-surface px-3.5 text-sm text-ink',
  'placeholder:text-ink-3/70 transition-[border-color,box-shadow] duration-150',
  'focus:outline-none focus:ring-4',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3',
);

const CONTROL_OK = 'border-line-strong focus:border-brand-500 focus:ring-brand-500/12';
const CONTROL_ERR = 'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/12';

/* ───────────────────────── Input ───────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leadingIcon, trailing, ...props },
  ref,
) {
  return (
    <div className="relative">
      {leadingIcon && (
        <span
          className="pointer-events-none absolute inset-y-0 flex items-center text-ink-3"
          style={{ insetInlineStart: '0.85rem' }}
          aria-hidden
        >
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL,
          invalid ? CONTROL_ERR : CONTROL_OK,
          'h-11',
          leadingIcon && 'ps-10',
          trailing && 'pe-11',
          className,
        )}
        {...props}
      />
      {trailing && (
        <span
          className="absolute inset-y-0 flex items-center"
          style={{ insetInlineEnd: '0.75rem' }}
        >
          {trailing}
        </span>
      )}
    </div>
  );
});

/* ───────────────────────── Textarea ───────────────────────── */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, invalid ? CONTROL_ERR : CONTROL_OK, 'min-h-28 resize-y py-3 leading-relaxed', className)}
      {...props}
    />
  );
});

/* ───────────────────────── Select ───────────────────────── */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        invalid ? CONTROL_ERR : CONTROL_OK,
        'h-11 appearance-none bg-no-repeat pe-9',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237c8398' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.75rem center',
      }}
      {...props}
    >
      {children}
    </select>
  );
});

/* ───────────────────────── Checkbox ───────────────────────── */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...props },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-surface p-3',
        'transition hover:border-brand-400 has-checked:border-brand-500 has-checked:bg-brand-500/5',
        className,
      )}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand-600"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  );
});

/* ───────────────────────── Switch ───────────────────────── */

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-4 rounded-xl border border-line-strong bg-surface p-3 text-start',
        'transition hover:border-brand-400 disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-3">{description}</span>}
      </span>
      <span
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-brand-600' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow transition-transform duration-200',
            // Move toward the "on" side, respecting document direction.
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0.5 rtl:-translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

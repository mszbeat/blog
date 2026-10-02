'use client';

import { cn, initials, resolveMedia } from '@/lib/utils';

/* ───────────────────────── Card ───────────────────────── */

export function Card({
  className, children, as: Tag = 'div', hover = false, ...rest
}: React.HTMLAttributes<HTMLDivElement> & { as?: React.ElementType; hover?: boolean }) {
  return (
    <Tag
      className={cn(
        // `relative` is load-bearing: PostCard/FeedItem use the stretched-link
        // pattern (`after:absolute after:inset-0`). Without a positioned card the
        // invisible hit-area escapes to the nearest positioned ancestor — often
        // the whole page — so clicking EMPTY MARGIN opened a post.
        'relative rounded-card border border-line bg-surface shadow-sm shadow-black/[0.02]',
        hover && 'transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md hover:shadow-black/[0.06]',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title, description, action, className, icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line p-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ───────────────────────── Badge ───────────────────────── */

type BadgeTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  brand: 'bg-brand-500/12 text-brand-700 ring-brand-500/20 dark:text-brand-300',
  neutral: 'bg-surface-3 text-ink-2 ring-line-strong',
  success: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400',
  warning: 'bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:text-amber-400',
  danger: 'bg-rose-500/12 text-rose-700 ring-rose-500/20 dark:text-rose-400',
  info: 'bg-sky-500/12 text-sky-700 ring-sky-500/20 dark:text-sky-400',
};

export function Badge({
  tone = 'neutral', className, children, icon,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ───────────────────────── Avatar ───────────────────────── */

export function Avatar({
  src, name, size = 'md', className,
}: {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const SIZES = {
    xs: 'size-6 text-[10px]',
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-14 text-lg',
    xl: 'size-24 text-3xl',
  };
  const url = resolveMedia(src);

  const inner = (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full',
        'bg-gradient-to-br from-brand-500 to-accent-500 font-bold text-white',
        SIZES[size],
        /* A quiet surface-coloured edge only — the coloured gradient "story
           ring" was removed site-wide, so an avatar is never wrapped in colour. */
        'ring-2 ring-surface',
        className,
      )}
      aria-hidden={!name}
    >
      {url ? (
        // Plain <img>: cover/avatar URLs may be relative (proxied through Next) or
        // absolute (Cloudinary). next/image cannot proxy both reliably here.
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={name ?? ''} className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="num-en">{initials(name)}</span>
      )}
    </span>
  );

  return inner;
}

/* ───────────────────────── Spinner ───────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      className={cn('inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      aria-label="loading"
    />
  );
}

/* ───────────────────────── Skeletons ───────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function PostCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-3 pt-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </Card>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ms-auto h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Empty state ───────────────────────── */

export function EmptyState({
  icon, title, description, action, className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      {icon && (
        <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-3 text-ink-3">
          {icon}
        </span>
      )}
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm leading-relaxed text-ink-3">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ───────────────────────── Alert ───────────────────────── */

export function Alert({
  tone = 'info', title, children, className, icon,
}: {
  tone?: BadgeTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  const BG: Record<BadgeTone, string> = {
    brand: 'border-brand-500/25 bg-brand-500/5 text-brand-800 dark:text-brand-200',
    neutral: 'border-line-strong bg-surface-2 text-ink-2',
    success: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200',
    warning: 'border-amber-500/30 bg-amber-500/8 text-amber-800 dark:text-amber-200',
    danger: 'border-rose-500/25 bg-rose-500/5 text-rose-800 dark:text-rose-200',
    info: 'border-sky-500/25 bg-sky-500/5 text-sky-800 dark:text-sky-200',
  };
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-xl border p-3.5 text-sm', BG[tone], className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'leading-relaxed opacity-90')}>{children}</div>}
      </div>
    </div>
  );
}

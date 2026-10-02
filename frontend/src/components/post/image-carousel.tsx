'use client';

/**
 * Instagram-style image gallery for a post.
 *
 * One image at a time with arrows, dots, a positional counter and touch-swipe,
 * so a post can carry a whole set of photos without stacking them into a very
 * tall column. Keyboard arrows work when the region is focused, and the whole
 * thing is a single `role="group"` so screen readers announce it as one widget.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ImageCarousel({
  images, alt, className,
}: {
  images: string[];
  /** Used for every slide's alt text (the post title reads well). */
  alt?: string;
  className?: string;
}) {
  const locale = useLocale();
  const rtl = locale === 'fa';
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const count = images.length;
  const safe = Math.min(index, count - 1);

  // If the set shrinks (edit removed images), never point past the end.
  useEffect(() => { if (index > count - 1) setIndex(Math.max(0, count - 1)); }, [count, index]);

  const go = useCallback((delta: number) => {
    setIndex((i) => (i + delta + count) % count);
  }, [count]);

  if (count === 0) return null;

  // A single image needs no chrome — render it plain.
  if (count === 1) {
    return (
      <div className={cn('overflow-hidden rounded-2xl border border-line bg-surface-3', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]} alt={alt ?? ''} className="aspect-[16/10] w-full object-cover" />
      </div>
    );
  }

  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={alt}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(rtl ? -1 : 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(rtl ? 1 : -1); }
      }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        // Swipe threshold; direction flips under RTL so it feels natural.
        if (Math.abs(dx) > 40) go((dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
        touchX.current = null;
      }}
      className={cn('group relative select-none overflow-hidden rounded-2xl border border-line bg-surface-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-400', className)}
    >
      {/* Slides — only the active one is in flow; others are swapped, not stacked. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={images[safe]}
        src={images[safe]}
        alt={alt ? `${alt} — ${safe + 1}/${count}` : ''}
        className="aspect-[16/10] w-full object-cover animate-fade-in"
        draggable={false}
      />

      {/* Counter */}
      <span className="num-en absolute top-3 flex items-center gap-1.5 rounded-full bg-slate-950/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm"
        style={{ insetInlineEnd: '0.75rem' }}>
        <Layers className="size-3" aria-hidden />
        {safe + 1} / {count}
      </span>

      {/* Arrows */}
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="previous"
        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-slate-950/45 p-2 text-white opacity-0 backdrop-blur-sm transition hover:bg-slate-950/70 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
        style={{ insetInlineStart: '0.6rem' }}
      >
        <PrevIcon className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="next"
        className="absolute top-1/2 -translate-y-1/2 rounded-full bg-slate-950/45 p-2 text-white opacity-0 backdrop-blur-sm transition hover:bg-slate-950/70 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
        style={{ insetInlineEnd: '0.6rem' }}
      >
        <NextIcon className="size-4" aria-hidden />
      </button>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}`}
            aria-current={i === safe}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === safe ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80',
            )}
          />
        ))}
      </div>
    </div>
  );
}

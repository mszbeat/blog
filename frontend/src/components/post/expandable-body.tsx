'use client';

/**
 * Post body with a "show more" collapse for long articles.
 *
 * A 4,000-word post used to push the comments several thousand pixels down the
 * page, so a reader who came for the discussion had to scroll past everything.
 * The body is measured after paint (and re-measured by a ResizeObserver, since
 * inline images and web fonts change its height later) and clamped only when
 * it genuinely overflows — short posts never get a pointless toggle.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PostBody } from '@/components/post-body';
import { cn } from '@/lib/utils';

/** Collapsed height. Generous enough to read a real opening, short enough that
 *  the reader can still see there is more below the fold. */
const COLLAPSE_AT_PX = 1100;

export function ExpandablePostBody({ content }: { content: string }) {
  const t = useTranslations('posts');
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setLong(el.scrollHeight > COLLAPSE_AT_PX + 160);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content]);

  const collapsed = long && !expanded;

  return (
    <div>
      <div
        ref={ref}
        className={cn('relative transition-[max-height] duration-300', collapsed && 'overflow-hidden')}
        style={collapsed ? { maxHeight: COLLAPSE_AT_PX } : undefined}
      >
        <PostBody content={content} />

        {/* Fade rather than a hard cut, so the clamp reads as "continues". */}
        {collapsed && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-surface-2 via-surface-2/85 to-transparent"
          />
        )}
      </div>

      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            'mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-4 py-2',
            'text-sm font-bold text-ink-2 transition hover:border-brand-400 hover:text-brand-600 active:scale-[0.98]',
            'dark:hover:text-brand-300',
          )}
        >
          {expanded ? t('seeLess') : t('seeMore')}
          <ChevronDown
            className={cn('size-4 transition-transform duration-200', expanded && 'rotate-180')}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}

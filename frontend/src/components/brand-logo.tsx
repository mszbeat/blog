/**
 * The Zlog brand mark.
 *
 * The wordmark is "Zlog", and the LEADING letter Z is the signature: it is
 * uppercase, heavier, optically oversized and painted in the apricot accent
 * gradient, while "log" stays lowercase and quiet in the page ink. The size +
 * hue + weight contrast makes Z read as a monogram rather than as the first
 * character of an ordinary word.
 *
 * Rendered as text (not the SVG) in the header/footer so it inherits the app's
 * fonts and theme colours; public/logo.svg is the standalone artwork and
 * public/favicon.svg is the browser-tab monogram wired up in the root layout.
 *
 * `dir="ltr"` is deliberate: this is a Latin wordmark, and without it an RTL
 * page would lay the inline-flex children out right-to-left and print "golZ".
 */

import { cn } from '@/lib/utils';

export function BrandLogo({
  className,
  size = 'md',
}: {
  className?: string;
  /** `sm` for dense spots (mobile drawer, dialogs), `md` for the header. */
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      className={cn(
        'brand-logo inline-flex items-baseline font-extrabold tracking-tight',
        size === 'sm' && 'text-base',
        size === 'md' && 'text-[1.0625rem]',
        size === 'lg' && 'text-2xl',
        className,
      )}
      dir="ltr"
      aria-label="Zlog"
    >
      {/* The signature letter: own hue, own weight, own optical size. */}
      <span className="brand-logo-z" aria-hidden>Z</span>
      <span className="text-ink">log</span>
    </span>
  );
}

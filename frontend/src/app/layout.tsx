import type { Metadata } from 'next';
import './globals.css';

/**
 * Favicon set. `public/favicon.svg` is the Z monogram on the iris→plum tile:
 * at tab-strip size a full wordmark is unreadable, so the icon carries only the
 * signature Z, while `public/logo.svg` keeps the complete "Zlog" wordmark.
 */
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/logo.svg', type: 'image/svg+xml' }],
  },
};

/**
 * Root layout.
 * With next-intl's `localePrefix: 'always'` the <html>/<body> tags live in
 * app/[locale]/layout.tsx so that `lang` and `dir` can be set per locale.
 *
 * globals.css (Tailwind v4 + design tokens + prose styles) is imported HERE so
 * it is bundled once for every locale.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import './globals.css';

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

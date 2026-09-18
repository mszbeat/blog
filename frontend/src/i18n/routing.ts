import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fa', 'en'] as const,
  defaultLocale: 'fa',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

/** Right-to-left locales — drives <html dir> and Tailwind's rtl:/ltr: variants. */
export const RTL_LOCALES: Locale[] = ['fa'];

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale as Locale);
}

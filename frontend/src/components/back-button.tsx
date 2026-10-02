'use client';

/**
 * Icon-only "back" control.
 *
 * Goes back through REAL HISTORY rather than to a hardcoded destination: the
 * previous version linked to /posts, so opening a post from a category, from a
 * profile or from search threw the reader back to the global list instead of
 * where they came from. When there is no history to return to (a link opened
 * directly, a fresh tab) it falls back to the post list.
 *
 * No label is rendered — the accessible name comes from aria-label/title, so the
 * button stays a single arrow at every breakpoint.
 */

import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { useRouter as useHistoryRouter } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';

// export function BackButton({
//   fallback = '/posts',
//   className,
// }: {
//   /** Where to go when there is no history to step back through. */
//   fallback?: string;
//   className?: string;
// }) {
//   const t = useTranslations('common');
//   const history = useHistoryRouter();
//   const router = useRouter();
//   const rtl = useLocale() === 'fa';

//   const onClick = () => {
//     if (typeof window !== 'undefined' && window.history.length > 1) history.back();
//     else router.replace(fallback);
//   };

//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       aria-label={t('back')}
//       title={t('back')}
//       className={cn(
//         'glass inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink',
//         'transition hover:border-brand-400 hover:text-brand-600 active:scale-95 dark:hover:text-brand-300',
//         className,
//       )}
//     >
//       {/* In RTL "back" points right, so the arrow is mirrored. */}
//       <ArrowLeft className={cn('size-4', rtl && 'rotate-180')} aria-hidden />
//     </button>
//   );
// }

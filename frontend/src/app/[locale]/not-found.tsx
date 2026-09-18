'use client';

import { useTranslations } from 'next-intl';
import { Compass } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/**
 * Rendered by notFound() and by unmatched routes.
 * Lives under [locale] so it inherits <html lang/dir> and the translations.
 */
export default function NotFound() {
  const t = useTranslations('errors');
  const tn = useTranslations('nav');
  const tp = useTranslations('posts');

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
      <span className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-xl shadow-brand-600/20">
        <Compass className="size-9" aria-hidden />
        <span className="absolute -bottom-2 -end-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-extrabold text-ink shadow ring-1 ring-line">
          404
        </span>
      </span>

      <h1 className="mt-8 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-2">{t('notFoundDesc')}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button size="lg">{t('backHome')}</Button>
        </Link>
        <Link href="/posts">
          <Button variant="secondary" size="lg">{tp('allPosts')}</Button>
        </Link>
        <Link href="/categories">
          <Button variant="ghost" size="lg">{tn('categories')}</Button>
        </Link>
      </div>
    </div>
  );
}

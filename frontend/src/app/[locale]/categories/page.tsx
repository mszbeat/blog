import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Layers } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getCategoriesCached } from '@/lib/server-api';
import { ApiDownNotice } from '@/components/api-down-notice';
import { Card, EmptyState } from '@/components/ui/primitives';
import { cn, gradientFor } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'categories' });
  return { title: t('title') };
}

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('categories');

  let categories: Awaited<ReturnType<typeof getCategoriesCached>> = [];
  let failed = false;
  try {
    categories = await getCategoriesCached();
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-sm text-ink-3">{t('noCategoriesDesc')}</p>
      </header>

      {failed && <div className="mt-7"><ApiDownNotice /></div>}

      {categories.length === 0 && !failed ? (
        <Card className="mt-8">
          <EmptyState
            icon={<Layers className="size-6" aria-hidden />}
            title={t('noCategories')}
            description={t('noCategoriesDesc')}
          />
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md hover:shadow-black/[0.06]"
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 top-0 h-1 grad-to-r opacity-70 transition-opacity group-hover:opacity-100',
                  gradientFor(c.slug),
                )}
              />
              <span className={cn('mt-1 flex size-10 items-center justify-center rounded-xl text-white shadow-sm', gradientFor(c.slug))}>
                <Layers className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-base font-bold text-ink group-hover:text-brand-600 dark:group-hover:text-brand-300">
                {c.name}
              </h2>
              {c.description ? (
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-3">
                  {c.description}
                </p>
              ) : (
                <span className="flex-1" />
              )}
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3">
                <code dir="ltr" className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                  /{c.slug}
                </code>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

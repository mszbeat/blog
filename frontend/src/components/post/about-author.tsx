import { getTranslations } from 'next-intl/server';
import { Eye } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Avatar } from '@/components/ui/primitives';
import { formatDate, formatNumber } from '@/lib/utils';
import type { Locale, User } from '@/lib/types';

/**
 * "About the author" card for the post detail sidebar.
 *
 * Server component: the author is already in the post payload, so this costs
 * no extra request and ships as HTML. Every element links to the public
 * profile — avatar, name and the explicit call to action.
 */
export async function AboutAuthor({
  author, locale, viewCount,
}: { author: User; locale: Locale; viewCount: number }) {
  const tc = await getTranslations('common');
  const rtl = locale === 'fa';

  return (
    <section
      aria-label={rtl ? 'دربارهٔ نویسنده' : 'About the author'}
      className="card p-4"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
        {rtl ? 'دربارهٔ نویسنده' : 'About the author'}
      </p>

      <Link
        href={`/users/${author.id}`}
        className="group mt-3 flex items-center gap-3"
      >
        <Avatar
            src={author.avatar}
            name={author.name}
            size="md"
            className="transition group-hover:scale-105"
          />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink transition group-hover:text-brand-600 dark:group-hover:text-brand-300">
            {author.name}
          </span>
          <span className="num-en mt-0.5 block text-xs text-ink-3">
            {tc('createdAt')}: {formatDate(author.createdAt, locale)}
          </span>
        </span>
      </Link>

      {author.bio && (
        <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-ink-2">
          {author.bio}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="num-en inline-flex items-center gap-1.5 text-xs text-ink-3" title={tc('views')}>
          <Eye className="size-3.5" aria-hidden />
          {formatNumber(viewCount, locale)}
        </span>
        <Link
          href={`/users/${author.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 transition hover:text-brand-700 dark:text-brand-300"
        >
          {rtl ? 'دیدن پروفایل' : 'View profile'}
        </Link>
      </div>
    </section>
  );
}

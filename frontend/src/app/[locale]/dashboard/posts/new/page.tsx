'use client';

import { useTranslations } from 'next-intl';
import { FilePlus2 } from 'lucide-react';
import { PostEditor } from '@/components/post-editor';

export default function NewPostPage() {
  const t = useTranslations('posts');
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <FilePlus2 className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{t('newPost')}</h2>
          <p className="text-sm text-ink-3">{t('slugNote')}</p>
        </div>
      </header>

      <PostEditor mode="create" />
    </div>
  );
}

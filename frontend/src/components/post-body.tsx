'use client';

import { useMemo } from 'react';
import { renderMarkdown } from '@/lib/utils';

/**
 * Renders `post.content`.
 *
 * The backend stores content as free text (no sanitisation server-side), so we
 * escape every character first and then apply a small Markdown subset — user
 * content can never inject raw HTML.
 */
export function PostBody({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content ?? ''), [content]);
  return (
    <div
      className="prose-blog max-w-none"
      // Safe: renderMarkdown() escapes all input before applying formatting.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

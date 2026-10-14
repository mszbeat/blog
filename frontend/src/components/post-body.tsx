'use client';

import { useMemo } from 'react';
import { renderMarkdown } from '@/lib/markdown';

/**
 * Renders `post.content`.
 *
 * The backend stores content as free text (no sanitisation server-side), so we
 * disable raw HTML and use the same safe Markdown parser as the editor — user
 * content can never inject raw HTML.
 */
export function PostBody({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content ?? ''), [content]);
  return (
    <div
      className="prose-blog max-w-none"
      // Safe: the shared parser disables raw HTML and validates link protocols.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

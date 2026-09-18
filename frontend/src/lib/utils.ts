import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Comment, CommentNode, Locale, Pagination } from './types';

export { type Locale };

/** Tailwind-aware className joiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolve a media URL for the browser.
 * • absolute http(s) (Cloudinary in production) → pass through
 * • already proxied (/api/…) → pass through
 * • root-relative from the API → prefix with the API base so the
 *   Next.js rewrite proxies it (keeps everything CORS-free)
 */
export function resolveMedia(url?: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api/')) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return url;
}

/** Base path the browser uses to reach the API (proxied by Next rewrites). */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

/* ───────────────────────── dates ───────────────────────── */

const FA_LOCALE = 'fa-IR-u-ca-persian';
const EN_LOCALE = 'en-GB';

export function formatDate(
  value?: string | Date | null,
  locale: Locale = 'fa',
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'fa' ? FA_LOCALE : EN_LOCALE, opts).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatDateTime(value?: string | Date | null, locale: Locale = 'fa'): string {
  return formatDate(value, locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Compact relative time — "۳ ساعت پیش" / "3 hours ago". */
export function formatRelative(value?: string | Date | null, locale: Locale = 'fa'): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return '—';
  try {
    const rtf = new Intl.RelativeTimeFormat(locale === 'fa' ? 'fa' : 'en', { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31536e6], ['month', 2592e6], ['week', 6048e5],
      ['day', 864e5], ['hour', 36e5], ['minute', 6e4],
    ];
    for (const [unit, ms] of units) {
      if (Math.abs(diff) >= ms) return rtf.format(-Math.round(diff / ms), unit);
    }
    return rtf.format(-Math.round(diff / 1000), 'second');
  } catch {
    return formatDate(d, locale);
  }
}

/** Localise digits — Persian uses ۰۱۲۳۴۵۶۷۸۹. */
export function formatNumber(n: number, locale: Locale = 'fa'): string {
  try {
    return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(n);
  } catch {
    return String(n);
  }
}

/* ───────────────────────── content ───────────────────────── */

/** Rough reading time from word count (~200 wpm, Persian counted the same way). */
export function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function truncate(text: string, max = 160): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

/** First letter(s) for avatar fallbacks. */
export function initials(name?: string | null): string {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]).join('');
}

/**
 * Minimal, safe Markdown-ish renderer.
 * The backend stores `content` as free text; we only support a small subset and
 * escape everything else so user content can never inject HTML.
 */
export function renderMarkdown(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let table: string[][] | null = null;

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const flushTable = () => {
    if (!table) return;
    const [head, ...body] = table;
    out.push('<table><thead><tr>' + head.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead>');
    if (body.length) {
      out.push('<tbody>' + body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>');
    }
    out.push('</table>');
    table = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^\|.*\|$/.test(line.trim())) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
      closeList();
      (table ??= []).push(cells);
      continue;
    }
    flushTable();

    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); continue; }

    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`); continue;
    }

    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ul) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`); continue;
    }

    const bq = line.match(/^>\s?(.*)$/);
    if (bq) { closeList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  flushTable();
  return out.join('\n');
}

/* ───────────────────────── comments ───────────────────────── */

/**
 * GET /posts/:postId/comments returns a FLAT array (the real service loads no
 * relations besides the eager `author`), so the reply tree must be assembled
 * here from `parentId`. Orphans are promoted to the root so nothing is lost.
 */
export function buildCommentTree(flat: Comment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();
  flat.forEach((c) => nodes.set(c.id, { ...c, replies: [] }));

  const roots: CommentNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) parent.replies.push(node);
    else roots.push(node);
  });

  const byDate = (a: CommentNode, b: CommentNode) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  const sortRec = (list: CommentNode[]) => {
    list.sort(byDate);
    list.forEach((n) => sortRec(n.replies));
  };
  sortRec(roots);
  return roots;
}

/** Total including every nested reply. */
export function countComments(tree: CommentNode[]): number {
  return tree.reduce((sum, n) => sum + 1 + countComments(n.replies), 0);
}

/* ───────────────────────── misc ───────────────────────── */

/** Deterministic gradient pair, used for placeholder covers. */
const GRADIENTS = [
  'from-indigo-500 to-purple-500', 'from-sky-500 to-cyan-400',
  'from-amber-500 to-rose-500', 'from-emerald-500 to-sky-500',
  'from-violet-500 to-pink-500', 'from-teal-500 to-lime-500',
];

export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ───────────────────────── pagination helpers ─────────────────────────
 *
 * The backend answers list endpoints with `{ data, meta }` and NO envelope.
 * These helpers normalise that into the shape pages consume, and build query
 * strings without losing unrelated params.
 */

export function parsePagination(
  meta: { total?: number; page?: number; limit?: number; totalPages?: number } | undefined,
  locale: Locale = 'fa',
): Pagination {
  void locale; // kept for call-site symmetry; numbers are formatted by callers
  return {
    page: meta?.page ?? 1,
    limit: meta?.limit ?? 12,
    totalItems: typeof meta?.total === 'number' ? meta.total : null,
    totalPages: meta?.totalPages ?? 1,
  };
}

/** Builds `?a=1&b=2`, dropping null/undefined/empty values. */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    p.set(k, String(v));
  }
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

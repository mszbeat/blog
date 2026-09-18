/**
 * Server-side data access for the public blog pages.
 *
 * Public pages (home, post list, post detail, categories) are Server
 * Components so their HTML is crawlable — a blog that renders nothing on the
 * server loses most of its SEO value. These fetch the backend DIRECTLY at
 * API_ORIGIN (server-to-server, so the missing CORS config is irrelevant),
 * while client components go through the /api proxy.
 */

import { cache } from 'react';
import type { Category, Paginated, Post, PostQuery } from './types';

const ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';

/**
 * Public content changes rarely, but in dev we want fresh data on every
 * request. `revalidate` is honoured in production builds.
 */
const IS_DEV = process.env.NODE_ENV !== 'production';
const CACHE: RequestCache = IS_DEV ? 'no-store' : 'force-cache';
const REVALIDATE = IS_DEV ? 0 : 60;

interface ApiEnvelope<T> {
  message: { en: string; fa: string } | string;
  data?: T;
}

class ServerApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ServerApiError';
  }
}

async function serverFetch<T>(path: string, query?: Record<string, unknown>): Promise<T> {
  const url = new URL(path, ORIGIN);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), {
    cache: CACHE,
    next: { revalidate: REVALIDATE },
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new ServerApiError(res.status, `GET ${path} → ${res.status}`);
  }

  const json = (await res.json()) as unknown;

  // Unwrap the bilingual envelope when present; paginated routes have none.
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    if ('message' in o && 'data' in o) return o.data as T;
  }
  return json as T;
}

/* ── public reads ── */

export const getPosts = (query: PostQuery = {}) =>
  serverFetch<Paginated<Post>>('/post', query as Record<string, unknown>);

export const getPostBySlug = (slug: string) =>
  serverFetch<Post>(`/post/${encodeURIComponent(slug)}`);

/** GET /categories nests one level deeper: data.categories */
export const getCategories = async (): Promise<Category[]> => {
  const data = await serverFetch<{ categories: Category[] }>('/categories');
  return data?.categories ?? [];
};

export const getCategoryBySlug = (slug: string) =>
  serverFetch<Category>(`/categories/${encodeURIComponent(slug)}`);

/**
 * `cache()` de-duplicates identical calls within a single request, so a page
 * and its layout can both ask for categories without a second round trip.
 */
export const getCategoriesCached = cache(getCategories);

/**
 * Cached list fetch. `cache()` de-dupes within one request, so the home page
 * and its sidebar can both ask for the same page of posts with one round trip.
 */
export const getPostsCached = cache((query: PostQuery = {}) => getPosts(query));

/* ───────────────────────── public author profile ─────────────────────────
 *
 * ⚠️ Backend constraint: `GET /users/:id` sits behind JwtAuthGuard, so an
 * anonymous visitor cannot read a user directly. But `GET /post` IS public and
 * left-joins `author`, so a user with at least one published post can be
 * reconstructed entirely from public data.
 *
 * This keeps author pages crawlable (SSR + SEO) without touching the backend.
 * Users with zero published posts fall back to a client-side authenticated
 * fetch — see <ProfileAuthFallback />.
 */

export interface AuthorProfile {
  author: Post['author'] | null;
  posts: Post[];
  /** True when we could not identify the user from public data at all. */
  unresolved: boolean;
  stats: { posts: number; views: number; published: number };
}

export const getAuthorProfile = cache(
  async (authorId: string, pageSize = 100): Promise<AuthorProfile> => {
    const empty = {
      author: null,
      posts: [],
      unresolved: true,
      stats: { posts: 0, views: 0, published: 0 },
    } satisfies AuthorProfile;

    try {
      const res = await getPosts({ page: 1, limit: pageSize, published: true });
      const all = res.data ?? [];
      const mine = all.filter((p) => p.authorId === authorId);
      const author = mine[0]?.author ?? null;

      if (!author && mine.length === 0) return empty;

      return {
        author,
        posts: mine,
        unresolved: !author,
        stats: {
          posts: mine.length,
          published: mine.filter((p) => p.published).length,
          views: mine.reduce((sum, p) => sum + (p.viewCount ?? 0), 0),
        },
      };
    } catch {
      return empty;
    }
  },
);

/** True when the backend is unreachable — lets pages degrade instead of crashing. */
export async function apiReachable(): Promise<boolean> {
  try {
    const res = await fetch(new URL('/', ORIGIN).toString(), { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export { ServerApiError };

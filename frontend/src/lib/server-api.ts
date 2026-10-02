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
import type { Category, Paginated, Post, PostQuery, PublicProfile } from './types';

const ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';

/**
 * Always fresh — never cached.
 *
 * These payloads carry the denormalised counters (`likeCount`, `commentCount`,
 * `viewCount`). With the previous `force-cache` + `revalidate: 60` a production
 * build served a page whose numbers were up to a minute old, so a like survived
 * the refresh as a filled heart (that comes from an uncached client call) while
 * the COUNT snapped back to the cached value. Correctness of a number the user
 * just changed beats saving one backend round trip; the pages are already
 * `force-dynamic`, so nothing else was being reused anyway.
 */
const CACHE: RequestCache = 'no-store';
const REVALIDATE = 0;

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

/* ══════════════════ public profile (authorised endpoint) ══════════════════ */

/**
 * `GET /users/:id/public` — the backend's aggregate author endpoint.
 *
 * This replaced the old `getAuthorProfile` heuristic (fetching 100 posts and
 * filtering client-side) as the PRIMARY source for /users/:id: it works for
 * users with zero published posts and returns real follower/like counters.
 *
 * Server Components call it unauthenticated, so `isFollowing`/`isSelf` are
 * always false here — the client layer re-reads it with the token attached.
 */
export const getPublicProfile = cache(async (userId: string): Promise<PublicProfile | null> => {
  try {
    return await serverFetch<PublicProfile>(`/users/${encodeURIComponent(userId)}/public`);
  } catch {
    return null;
  }
});

/** Published posts by one author, using the backend's `author` query filter. */
export const getPostsByAuthor = cache(
  async (userId: string, limit = 48): Promise<Post[]> => {
    try {
      const res = await getPosts({ author: userId, published: true, page: 1, limit });
      return res.data ?? [];
    } catch {
      return [];
    }
  },
);

/** Everything the author page needs, fetched in parallel for SSR. */
export interface AuthorPageData {
  profile: PublicProfile | null;
  posts: Post[];
}

export const getAuthorPageData = cache(async (userId: string): Promise<AuthorPageData> => {
  const [profile, posts] = await Promise.all([
    getPublicProfile(userId),
    getPostsByAuthor(userId),
  ]);
  return { profile, posts };
});

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

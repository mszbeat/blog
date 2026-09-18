/**
 * API client.
 *
 * Handles the three things that make this backend particular:
 *
 *  1. TWO different success shapes — the bilingual envelope
 *     `{ message:{en,fa}, data }` for most routes, but a bare
 *     `{ data, meta }` for paginated lists and a raw array for GET /users.
 *  2. TWO different error shapes — `{ statusCode, message:{en,fa} }` for known
 *     errors, but `message: string[]` when ValidationPipe rejects a payload.
 *  3. TOKEN ROTATION — AuthService.refreshToken() deletes the old Redis session
 *     before issuing new tokens, so the previous access token dies instantly.
 *     Refreshing must therefore be single-flight, or parallel 401s will each
 *     trigger their own refresh and all but the first will fail.
 */

import type { Locale } from './types';
import { API_BASE } from './utils';
import type {
  ApiErrorBody, ApiEnvelope, AuthResult, BilingualMessage, Category,
  ChangePasswordPayload, Comment, CreateCategoryPayload, CreateCommentPayload,
  CreatePostPayload, CreateUserPayload, LoginPayload, Paginated, Post,
  PostQuery, RefreshResult, RegisterPayload, UpdateCategoryPayload,
  UpdateCommentPayload, UpdatePostPayload, UpdateUserPayload, User,
} from './types';

/* ══════════════════ token storage ══════════════════ */

const K_ACCESS = 'blog.accessToken';
const K_REFRESH = 'blog.refreshToken';

const isBrowser = () => typeof window !== 'undefined';

export const tokenStore = {
  get access() { return isBrowser() ? localStorage.getItem(K_ACCESS) : null; },
  get refresh() { return isBrowser() ? localStorage.getItem(K_REFRESH) : null; },
  set(accessToken: string, refreshToken: string) {
    if (!isBrowser()) return;
    localStorage.setItem(K_ACCESS, accessToken);
    localStorage.setItem(K_REFRESH, refreshToken);
  },
  clear() {
    if (!isBrowser()) return;
    localStorage.removeItem(K_ACCESS);
    localStorage.removeItem(K_REFRESH);
  },
};

/* ══════════════════ errors ══════════════════ */

export class ApiError extends Error {
  readonly status: number;
  /** ValidationPipe errors — plain strings, already English-only. */
  readonly details: string[];
  readonly fa?: string;
  readonly en?: string;

  constructor(status: number, message: BilingualMessage | string | string[] | undefined, fallback: string) {
    let fa: string | undefined;
    let en: string | undefined;
    let details: string[] = [];

    if (Array.isArray(message)) {
      details = message;
      en = message.join(' · ');
    } else if (message && typeof message === 'object') {
      fa = message.fa;
      en = message.en;
    } else if (typeof message === 'string' && message) {
      en = fa = message;
    }

    super(fa ?? en ?? fallback);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.fa = fa;
    this.en = en;
  }

  /** Pick the message matching the active UI locale, with sane fallbacks. */
  messageFor(locale: Locale, fallback = 'Something went wrong'): string {
    if (this.status === 429) {
      return locale === 'fa' ? 'درخواست‌های بیش از حد — کمی صبر کنید.' : 'Too many requests — please wait a moment.';
    }
    if (this.details.length && locale === 'fa' && !this.fa) {
      // Validation messages only exist in English; flag them clearly.
      return `خطای اعتبارسنجی: ${this.details.join(' · ')}`;
    }
    return (locale === 'fa' ? this.fa : this.en) ?? this.en ?? this.fa ?? fallback;
  }

  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isConflict() { return this.status === 409; }
  get isValidation() { return this.status === 400 && this.details.length > 0; }
}

/** True when the browser could not reach the server at all. */
export class NetworkError extends ApiError {
  constructor(cause?: unknown) {
    super(0, undefined, 'Network error');
    this.name = 'NetworkError';
    void cause;
  }
}

/* ══════════════════ single-flight refresh ══════════════════ */

let refreshInFlight: Promise<boolean> | null = null;

/** Fired when the refresh token is dead too — the auth layer logs the user out. */
type SessionLostHandler = () => void;
const sessionLostHandlers = new Set<SessionLostHandler>();
export const onSessionLost = (fn: SessionLostHandler): (() => void) => {
  sessionLostHandlers.add(fn);
  // Must return void — Set.delete() returns a boolean, which React rejects
  // as an effect destructor.
  return () => { sessionLostHandlers.delete(fn); };
};
const emitSessionLost = () => sessionLostHandlers.forEach((fn) => { try { fn(); } catch { /* noop */ } });

async function refreshTokens(): Promise<boolean> {
  // Collapse concurrent 401s into ONE refresh call.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const rt = tokenStore.refresh;
    if (!rt) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rt}` },
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiEnvelope<RefreshResult>;
      const data = json?.data;
      if (!data?.accessToken || !data?.refreshToken) return false;
      tokenStore.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Released on the next microtask so callers awaiting this promise all
      // observe the same result before a new refresh may start.
      queueMicrotask(() => { refreshInFlight = null; });
    }
  })();

  const okRefresh = await refreshInFlight;
  if (!okRefresh) {
    tokenStore.clear();
    emitSessionLost();
  }
  return okRefresh;
}

/** Exposed so the auth provider can proactively refresh before expiry. */
export { refreshTokens };

/* ══════════════════ core request ══════════════════ */

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Attach the Bearer token. */
  auth?: boolean;
  /** Retry once after a token refresh on 401. Default: true when auth is set. */
  retryOn401?: boolean;
  /** Skip envelope unwrapping and return the parsed JSON as-is. */
  raw?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

/** Unwrap `{ message, data }` → `data`, passing through non-enveloped bodies. */
function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const o = json as Record<string, unknown>;
    if ('message' in o && 'data' in o) return o.data as T;
    if ('message' in o && !('data' in o)) return undefined as T;
  }
  return json as T;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, auth = false, retryOn401 = auth, raw = false, query, headers, ...rest } = opts;

  const doFetch = async (attempt: number): Promise<T> => {
    const finalHeaders = new Headers(headers);
    if (body !== undefined && !(body instanceof FormData)) {
      finalHeaders.set('Content-Type', 'application/json');
    }
    if (auth) {
      const token = tokenStore.access;
      if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
    }

    let res: Response;
    try {
      res = await fetch(buildUrl(path, query), {
        ...rest,
        headers: finalHeaders,
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new NetworkError(e);
    }

    if (res.status === 401 && auth && retryOn401 && attempt === 0) {
      const refreshed = await refreshTokens();
      if (refreshed) return doFetch(1);
    }

    if (res.status === 204) return undefined as T;

    // Some error paths return an empty body.
    const text = await res.text();
    let json: unknown = undefined;
    if (text) {
      try { json = JSON.parse(text); } catch { json = text; }
    }

    if (!res.ok) {
      const errBody = json as ApiErrorBody | undefined;
      throw new ApiError(res.status, errBody?.message, `Request failed (${res.status})`);
    }

    return raw ? (json as T) : unwrap<T>(json);
  };

  return doFetch(0);
}

/* ══════════════════ typed endpoints ══════════════════ */

/** Paths are singular/plural exactly as the NestJS controllers declare them. */
export const api = {
  /* ── auth ── */
  login: (payload: LoginPayload) =>
    request<AuthResult>('/auth/login', { method: 'POST', body: payload }),

  register: (payload: RegisterPayload) =>
    request<AuthResult>('/auth/register', { method: 'POST', body: payload }),

  me: () => request<User>('/auth/me', { auth: true }),

  logout: () => request<void>('/auth/logout', { method: 'POST', auth: true, retryOn401: false }),

  /* ── posts ── */
  posts: (query: PostQuery = {}) =>
    request<Paginated<Post>>('/post', { query: query as Record<string, string | number | boolean | undefined>, raw: true }),

  myPosts: (query: PostQuery = {}) =>
    request<Paginated<Post>>('/post/my', { auth: true, query: query as Record<string, string | number | boolean | undefined>, raw: true }),

  postBySlug: (slug: string) =>
    request<Post>(`/post/${encodeURIComponent(slug)}`),

  createPost: (payload: CreatePostPayload) =>
    request<Post>('/post', { method: 'POST', auth: true, body: payload }),

  updatePost: (id: string, payload: UpdatePostPayload) =>
    request<Post>(`/post/${id}`, { method: 'PATCH', auth: true, body: payload }),

  deletePost: (id: string) =>
    request<void>(`/post/${id}`, { method: 'DELETE', auth: true }),

  /* ── categories ── */
  /** GET /categories nests one level deeper: data.categories */
  categories: async () => {
    const data = await request<{ categories: Category[] }>('/categories');
    return data?.categories ?? [];
  },

  categoryBySlug: (slug: string) =>
    request<Category>(`/categories/${encodeURIComponent(slug)}`),

  createCategory: (payload: CreateCategoryPayload) =>
    request<Category>('/categories', { method: 'POST', auth: true, body: payload }),

  updateCategory: (id: string, payload: UpdateCategoryPayload) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', auth: true, body: payload }),

  deleteCategory: (id: string) =>
    request<void>(`/categories/${id}`, { method: 'DELETE', auth: true }),

  /* ── comments ── */
  comments: (postId: string) =>
    request<Comment[]>(`/posts/${postId}/comments`),

  createComment: (postId: string, payload: CreateCommentPayload) =>
    request<Comment>(`/posts/${postId}/comments`, { method: 'POST', auth: true, body: payload }),

  updateComment: (id: string, payload: UpdateCommentPayload) =>
    request<Comment>(`/comments/${id}`, { method: 'PATCH', auth: true, body: payload }),

  deleteComment: (id: string) =>
    request<void>(`/comments/${id}`, { method: 'DELETE', auth: true }),

  /* ── users ── */
  /** Returns a RAW array — no envelope on this route. */
  users: () => request<User[]>('/users', { auth: true, raw: true }),

  user: (id: string) => request<User>(`/users/${id}`, { auth: true }),

  createUser: (payload: CreateUserPayload) =>
    request<User>('/users', { method: 'POST', auth: true, body: payload }),

  updateUser: (id: string, payload: UpdateUserPayload) =>
    request<User>(`/users/${id}`, { method: 'PATCH', auth: true, body: payload }),

  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: 'DELETE', auth: true }),

  changePassword: (payload: ChangePasswordPayload) =>
    request<void>('/users/me/password', { method: 'PATCH', auth: true, body: payload }),

  /* ── uploads (multipart, field name must be exactly "file") ── */
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>('/uploads/avatar', { method: 'POST', auth: true, body: fd });
  },

  uploadCover: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>('/uploads/cover', { method: 'POST', auth: true, body: fd });
  },
};

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
  AdminUpdateUserPayload, ApiErrorBody, ApiEnvelope, AuthResult, BilingualMessage, Category,
  ChangePasswordPayload, Comment, CreateCategoryPayload, CreateCommentPayload,
  CreatePostPayload, CreateUserPayload, FollowState, LikeState, LoginPayload,
  Notification, NotificationQuery, Paginated, Post, PostQuery, PublicProfile,
  RefreshResult, RegisterPayload, UpdateCategoryPayload, UpdateCommentPayload,
  UpdatePostPayload, UpdateUserPayload, UnreadSummary, User,
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

/**
 * The request was still in flight when its budget ran out.
 *
 * Distinct from NetworkError so the UI can say "this is taking too long"
 * instead of "the server is unreachable" — a large image on a slow uplink is
 * neither a dead server nor a validation failure, and the retry affordance is
 * different.
 */
export class TimeoutError extends ApiError {
  constructor(readonly ms: number, cause?: unknown) {
    const secs = Math.round(ms / 1000);
    super(
      0,
      {
        en: `This is taking longer than ${secs}s — the request was cancelled. Check your connection and try a smaller file.`,
        fa: `این عملیات بیش از ${secs} ثانیه طول کشید و درخواست لغو شد. اتصال خود را بررسی کنید و فایل کوچک‌تری انتخاب کنید.`,
      },
      'Request timed out',
    );
    this.name = 'TimeoutError';
    void cause;
  }
}

/**
 * Uploads get a full minute before the client gives up.
 *
 * A phone on 3G pushing a 6 MB photo genuinely needs this; anything shorter
 * turns a slow-but-fine upload into a confusing error. Matches the backend's
 * own `UPLOAD_TIMEOUT_MS` so neither side aborts the other mid-transfer.
 */
export const UPLOAD_TIMEOUT_MS = 60_000;

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
  /**
   * Attach the token IF one exists, but never treat a 401/expiry as fatal.
   *
   * For routes behind the backend's OptionalJwtAuthGuard (public profile,
   * post list/detail): an anonymous visitor must still get a 200, and a stale
   * token must not kick off a refresh loop on a page that works fine without
   * it. Implies `auth: true` for header purposes and forces retryOn401 off.
   */
  optionalAuth?: boolean;
  /** Retry once after a token refresh on 401. Default: true when auth is set. */
  retryOn401?: boolean;
  /** Skip envelope unwrapping and return the parsed JSON as-is. */
  raw?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Abort after this many ms and throw TimeoutError. No timeout by default. */
  timeoutMs?: number;
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
  const {
    body, optionalAuth = false, auth = optionalAuth, raw = false, query, headers,
    timeoutMs, signal, ...rest
  } = opts;
  // A public endpoint must not spin on refresh: without retryOn401 a stale
  // token simply degrades to the anonymous response, which is still a 200.
  const retryOn401 = opts.retryOn401 ?? (auth && !optionalAuth);

  const doFetch = async (attempt: number): Promise<T> => {
    const finalHeaders = new Headers(headers);
    if (body !== undefined && !(body instanceof FormData)) {
      finalHeaders.set('Content-Type', 'application/json');
    }
    if (auth) {
      const token = tokenStore.access;
      if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
    }

    /* Combine the caller's signal with an optional deadline into one controller,
     * so a caller can still cancel without losing the timeout (and vice versa). */
    const ctl = new AbortController();
    const timer = timeoutMs ? setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs) : null;
    const onCallerAbort = () => ctl.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) ctl.abort(signal.reason);
      else signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    let res: Response;
    try {
      res = await fetch(buildUrl(path, query), {
        ...rest,
        cache: 'no-store',
        headers: finalHeaders,
        signal: ctl.signal,
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      /* Our own deadline produced a 'TimeoutError' reason; a caller-driven abort
       * is re-thrown untouched so React Query can treat it as a cancellation. */
      if (ctl.signal.aborted && !signal?.aborted) throw new TimeoutError(timeoutMs ?? 0, e);
      if (signal?.aborted) throw e;
      throw new NetworkError(e);
    } finally {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onCallerAbort);
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

  /** People search for the follow flow — RAW array, auth-gated. */
  searchUsers: (q: string, limit = 20) =>
    request<User[]>('/users/search', { auth: true, raw: true, query: { q, limit } }),

  user: (id: string) => request<User>(`/users/${id}`, { auth: true }),

  createUser: (payload: CreateUserPayload) =>
    request<User>('/users', { method: 'POST', auth: true, body: payload }),

  updateUser: (id: string, payload: UpdateUserPayload) =>
    request<User>(`/users/${id}`, { method: 'PATCH', auth: true, body: payload }),

  /**
   * ADMIN-ONLY management of ANY user — the sole route that accepts `email`
   * and `role`, i.e. promote user → admin or demote admin → user.
   *
   * The backend keeps this on its own path with its own DTO precisely so the
   * self-service `PATCH /users/:id` can never be talked into a role change;
   * `forbidNonWhitelisted` rejects any field AdminUpdateUserDto does not
   * declare, so the payload below must stay exactly this shape.
   */
  adminUpdateUser: (id: string, payload: AdminUpdateUserPayload) =>
    request<User>(`/users/${id}/admin`, { method: 'PATCH', auth: true, body: payload }),

  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: 'DELETE', auth: true }),

  changePassword: (payload: ChangePasswordPayload) =>
    request<void>('/users/me/password', { method: 'PATCH', auth: true, body: payload }),

  /* ── public profile ──
   * GET /users/:id is behind JwtAuthGuard, so an anonymous visitor cannot read
   * it. This aggregate endpoint is public (OptionalJwtAuthGuard) and returns
   * the user, their stats and the viewer's follow state in ONE call.
   */
  publicProfile: (id: string) =>
    request<PublicProfile>(`/users/${id}/public`, { auth: true, optionalAuth: true }),

  /* ── follow ── */
  follow: (id: string) =>
    request<FollowState>(`/users/${id}/follow`, { method: 'POST', auth: true }),

  unfollow: (id: string) =>
    request<FollowState>(`/users/${id}/follow`, { method: 'DELETE', auth: true }),

  followers: (id: string, query: { page?: number; limit?: number } = {}) =>
    request<Paginated<User>>(`/users/${id}/followers`, { query: query as Record<string, string | number | undefined>, raw: true }),

  following: (id: string, query: { page?: number; limit?: number } = {}) =>
    request<Paginated<User>>(`/users/${id}/following`, { query: query as Record<string, string | number | undefined>, raw: true }),

  /* Sending {liked} expresses intent and is idempotent. Omitting it retains
   * backwards-compatible toggle semantics for older clients. */
  toggleLike: (postId: string, liked?: boolean) =>
    request<LikeState>(`/posts/${postId}/like`, { method: 'POST', auth: true, body: { liked } }),

  /** Exact ids the user liked — narrow payload, owner-only. */
  likedIds: (id: string) => request<string[]>(`/users/${id}/liked-ids`, { auth: true }),

  likedPosts: (id: string, query: { page?: number; limit?: number } = {}) =>
    request<Paginated<Post>>(`/users/${id}/likes`, { auth: true, query: query as Record<string, string | number | undefined>, raw: true }),

  postLikers: (postId: string) =>
    request<User[]>(`/posts/${postId}/likes`),

  /* ── notifications ── */
  notifications: (query: NotificationQuery = {}) =>
    request<Paginated<Notification>>('/notifications', {
      auth: true,
      // Nested under `data` (unlike /post) so the envelope stays consistent.
      query: query as Record<string, string | number | boolean | undefined>,
    }),

  /** Polled for the header badge + live toast; @SkipThrottle on the backend. */
  unreadNotifications: () =>
    request<UnreadSummary>('/notifications/unread', { auth: true }),

  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: 'PATCH', auth: true }),

  markAllNotificationsRead: () =>
    request<{ affected: number }>('/notifications/read-all', { method: 'PATCH', auth: true }),

  deleteNotification: (id: string) =>
    request<void>(`/notifications/${id}`, { method: 'DELETE', auth: true }),

  /* ── uploads (multipart, field name must be exactly "file") ── */
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>('/uploads/avatar', {
      method: 'POST', auth: true, body: fd, timeoutMs: UPLOAD_TIMEOUT_MS,
    });
  },

  uploadCover: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string }>('/uploads/cover', {
      method: 'POST', auth: true, body: fd, timeoutMs: UPLOAD_TIMEOUT_MS,
    });
  },
};

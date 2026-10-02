/**
 * Types mirroring the NestJS backend entities & DTOs exactly.
 * Source of truth: /home/user/backend/src/**\/entities + /dto
 */

export type UserRole = 'admin' | 'user' | 'guest';

/** Re-exported so the data layer can import every type from one place. */
export type { Locale } from '../i18n/routing';

/** The backend's bilingual response envelope (ResponseDetail). */
export interface BilingualMessage {
  en: string;
  fa: string;
}

export interface ApiEnvelope<T> {
  message: BilingualMessage | string | string[];
  data?: T;
}

/** PaginatedResponse<T> — note: NO envelope wrapper on these endpoints. */
export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** HttpExceptionFilter output. */
export interface ApiErrorBody {
  statusCode: number;
  /** Object for known errors, string[] for ValidationPipe errors. */
  message: BilingualMessage | string | string[];
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  bio?: string | null;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  /** Only populated by GET /categories/:slug */
  posts?: Post[];
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  coverImage?: string | null;
  /** Instagram-style gallery, upload order. Rendered as a carousel. */
  images?: string[] | null;
  published: boolean;
  authorId: string;
  /**
   * NOT returned by GET /post/my — the real service skips the join there.
   * Always guard against undefined.
   */
  author?: User | null;
  categories?: Category[];
  viewCount: number;
  /** Denormalised counters, kept in sync server-side. */
  likeCount?: number;
  commentCount?: number;
  /**
   * Only present when the request carried a valid access token — the route is
   * guarded by OptionalJwtAuthGuard so anonymous visitors still get the list.
   */
  likedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  /** eager: true on the entity, so always present. */
  author?: User | null;
  postId: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A comment plus its nested replies — built client-side from parentId,
 *  because GET /posts/:postId/comments returns a FLAT list. */
export interface CommentNode extends Comment {
  replies: CommentNode[];
}

/* ── Request payloads (must match DTOs exactly: forbidNonWhitelisted is ON,
 *    so sending ANY extra property makes the backend answer 400) ── */

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export interface CreatePostPayload {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  images?: string[];
  published?: boolean;
  categories?: string[];
}

export type UpdatePostPayload = Partial<CreatePostPayload>;

export interface CreateCategoryPayload {
  name: string;
  description?: string;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export interface CreateCommentPayload {
  content: string;
  parentId?: string;
}

export interface UpdateCommentPayload {
  content: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role?: UserRole;
  bio?: string;
}

/** UpdateUserDto = Partial(Omit(CreateUserDto, email|password|confirmPassword)) */
export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  bio?: string;
  avatar?: string;
}

/**
 * Body of `PATCH /users/:id/admin` — mirrors AdminUpdateUserDto field-for-field.
 *
 * This is the only endpoint that accepts `email` and a `role` change, and the
 * backend runs `forbidNonWhitelisted`, so sending anything else (or a field it
 * does not declare) is a 400 rather than a silent no-op.
 */
export interface AdminUpdateUserPayload {
  name?: string;
  email?: string;
  bio?: string;
  avatar?: string;
  role?: UserRole;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface PostQuery {
  page?: number;
  limit?: number;
  published?: boolean;
  category?: string;
  /** Server-side author filter — powers the public profile's Posts tab. */
  author?: string;
}

/* ───────────────────────── pagination ─────────────────────────
 *
 * The backend answers list endpoints with `{ data, meta }` (no envelope).
 * Pages consume this normalised shape instead of reading `meta` directly.
 */
export interface Pagination {
  page: number;
  limit: number;
  totalItems: number | null;
  totalPages: number;
}

/* ───────────────────────── social graph ─────────────────────────
 *
 * Added to the backend for this project (see backend/src/social):
 *   Follow  — unique (followerId, followingId)
 *   Like    — unique (userId, postId), with Post.likeCount kept in sync
 *
 * Post now also carries denormalised counters (`likeCount`, `commentCount`)
 * following the same pattern the entity already used for `viewCount`, plus a
 * per-request `likedByMe` stamped by OptionalJwtAuthGuard.
 */

/** Follow/unfollow endpoints answer with the fresh state, not an entity. */
export interface FollowState {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

export interface LikeState {
  liked: boolean;
  likeCount: number;
}

/** One of the four activity types the bell renders. */
export type NotificationType = 'follow' | 'like' | 'comment' | 'reply';

/**
 * A notification as it comes over the wire: `actor` and a MINIMAL `post`
 * (id/slug/title/coverImage) are already hydrated by the API, so the bell can
 * render a thumbnail + link without any extra request.
 */
export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  actor: User | null;
  type: NotificationType;
  postId?: string | null;
  /** Trimmed post shape — enough for a cover thumbnail and a permalink. */
  post?: {
    id: string;
    slug: string;
    title: string;
    coverImage?: string | null;
    published: boolean;
  } | null;
  commentId?: string | null;
  comment?: { id: string; content: string } | null;
  /** Frozen preview of the comment text at creation time. */
  excerpt?: string | null;
  read: boolean;
  createdAt: string;
}

/** GET /notifications/unread — polled for the badge and the live toast. */
export interface UnreadSummary {
  count: number;
  byType: Record<NotificationType, number>;
  /** Newest few, pre-hydrated so a toast can render immediately. */
  latest: Notification[];
}

/** GET /users/:id/public — everything an author page needs in ONE call. */
export interface PublicProfile {
  user: User;
  stats: {
    posts: number;
    views: number;
    likes: number;
    followers: number;
    following: number;
  };
  isFollowing: boolean;
  isSelf: boolean;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  unread?: boolean;
  type?: NotificationType;
}

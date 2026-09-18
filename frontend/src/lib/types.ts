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
  published: boolean;
  authorId: string;
  /**
   * NOT returned by GET /post/my — the real service skips the join there.
   * Always guard against undefined.
   */
  author?: User | null;
  categories?: Category[];
  viewCount: number;
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

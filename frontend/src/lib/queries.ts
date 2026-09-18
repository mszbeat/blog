/**
 * TanStack Query hooks — one place for every server-state read/write.
 *
 * Query keys are hierarchical so mutations can invalidate precisely:
 *   ['posts', query]            list (public)
 *   ['posts', 'mine', query]    authenticated author list
 *   ['post', slug]              single post
 *   ['categories']              list
 *   ['comments', postId]        flat list for a post
 *   ['users']                   admin list
 */

import {
  useMutation, useQuery, useQueryClient, type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Category, ChangePasswordPayload, Comment, CreateCategoryPayload,
  CreateCommentPayload, CreatePostPayload, CreateUserPayload, LoginPayload,
  Paginated, Post, PostQuery, RegisterPayload, UpdateCategoryPayload,
  UpdateCommentPayload, UpdatePostPayload, UpdateUserPayload, User,
} from '@/lib/types';

export const keys = {
  posts: (q: PostQuery = {}) => ['posts', q] as const,
  myPosts: (q: PostQuery = {}) => ['posts', 'mine', q] as const,
  post: (slug: string) => ['post', slug] as const,
  categories: ['categories'] as const,
  category: (slug: string) => ['category', slug] as const,
  comments: (postId: string) => ['comments', postId] as const,
  users: ['users'] as const,
  user: (id: string) => ['user', id] as const,
};

/* ══════════════════ reads ══════════════════ */

export function usePosts(query: PostQuery = {}, options?: Partial<UseQueryOptions<Paginated<Post>>>) {
  return useQuery({
    queryKey: keys.posts(query),
    queryFn: () => api.posts(query),
    placeholderData: (prev) => prev, // keep the old page visible while loading
    ...options,
  });
}

export function useMyPosts(query: PostQuery = {}, enabled = true) {
  return useQuery({
    queryKey: keys.myPosts(query),
    queryFn: () => api.myPosts(query),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function usePost(slug: string, enabled = true) {
  return useQuery({
    queryKey: keys.post(slug),
    queryFn: () => api.postBySlug(slug),
    enabled: !!slug && enabled,
    retry: (count, err) => {
      if ((err as { status?: number })?.status === 404) return false;
      return count < 2;
    },
  });
}

export function useCategories(options?: Partial<UseQueryOptions<Category[]>>) {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.categories(),
    staleTime: 5 * 60_000,
    ...options,
  });
}

export function useCategory(slug: string, enabled = true) {
  return useQuery({
    queryKey: keys.category(slug),
    queryFn: () => api.categoryBySlug(slug),
    enabled: !!slug && enabled,
  });
}

export function useComments(postId: string, enabled = true) {
  return useQuery({
    queryKey: keys.comments(postId),
    queryFn: () => api.comments(postId),
    enabled: !!postId && enabled,
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: keys.users,
    queryFn: () => api.users(),
    enabled,
  });
}

/* ══════════════════ auth mutations ══════════════════ */

export function useLogin() {
  return useMutation({ mutationFn: (p: LoginPayload) => api.login(p) });
}

export function useRegister() {
  return useMutation({ mutationFn: (p: RegisterPayload) => api.register(p) });
}

/* ══════════════════ post mutations ══════════════════ */

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreatePostPayload) => api.createPost(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePostPayload }) =>
      api.updatePost(id, payload),
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: keys.post(post.slug) });
      // Title changes regenerate the slug, so the old key is stale too.
      qc.invalidateQueries({ queryKey: ['post'] });
      qc.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePost(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] });
      qc.invalidateQueries({ queryKey: ['post'] });
    },
  });
}

/* ══════════════════ category mutations ══════════════════ */

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateCategoryPayload) => api.createCategory(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) =>
      api.updateCategory(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: ['category'] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

/* ══════════════════ comment mutations ══════════════════ */

export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateCommentPayload) => api.createComment(postId, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(postId) }),
  });
}

export function useUpdateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCommentPayload }) =>
      api.updateComment(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(postId) }),
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(postId) }),
  });
}

/* ══════════════════ user mutations ══════════════════ */

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateUserPayload) => api.createUser(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.users }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      api.updateUser(id, payload),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: keys.users });
      qc.invalidateQueries({ queryKey: keys.user(user.id) });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.users }),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (p: ChangePasswordPayload) => api.changePassword(p) });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadAvatar(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.users }),
  });
}

export function useUploadCover() {
  return useMutation({ mutationFn: (file: File) => api.uploadCover(file) });
}

/* ══════════════════ helpers ══════════════════ */

/** Stats derived from the author's own posts (dashboard overview). */
export function useMyStats(enabled = true) {
  return useQuery({
    queryKey: [...keys.myPosts({ page: 1, limit: 100 }), 'stats'] as const,
    queryFn: async () => {
      const res = await api.myPosts({ page: 1, limit: 100 });
      const items = res.data ?? [];
      return {
        total: res.meta?.total ?? items.length,
        published: items.filter((p) => p.published).length,
        drafts: items.filter((p) => !p.published).length,
        views: items.reduce((sum, p) => sum + (p.viewCount ?? 0), 0),
        recent: items.slice(0, 5),
      };
    },
    enabled,
    staleTime: 30_000,
  });
}

export type { Comment, Post, User, Category };

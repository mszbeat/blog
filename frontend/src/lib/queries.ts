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
import { useAuth } from '@/lib/auth-context';
import { useSocialStore } from '@/lib/social-store';
import type {
  Category, ChangePasswordPayload, Comment, CreateCategoryPayload,
  CreateCommentPayload, CreatePostPayload, CreateUserPayload, LoginPayload,
  Notification, NotificationQuery, Paginated, Post, PostQuery, PublicProfile,
  RegisterPayload, UnreadSummary, UpdateCategoryPayload, UpdateCommentPayload,
  AdminUpdateUserPayload, UpdatePostPayload, UpdateUserPayload, User,
} from '@/lib/types';

/**
 * TASK: every activity must be reflected everywhere, instantly.
 *
 * A single social action ripples into several independent caches: liking a post
 * moves the card in the feed, the article header AND the author's "likes
 * received" stat on their profile; commenting moves the feed card's count and
 * the author's comment stat; following moves BOTH the target's follower count
 * and the viewer's own following count, which live in two different
 * publicProfile entries.
 *
 * Invalidating one key at a time is how counters end up disagreeing with each
 * other across pages. These helpers name the ripple once so every mutation
 * agrees on it. Invalidation is cheap — it only refetches ACTIVE queries — so
 * the wide prefix costs nothing for pages the user is not looking at.
 */
const refreshCounters = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['posts'] });            // feed cards: like + comment counts
  qc.invalidateQueries({ queryKey: ['post'] });             // article header counts
  qc.invalidateQueries({ queryKey: ['profile', 'public'] }); // EVERY profile stat: author's + viewer's
};

export const keys = {
  posts: (q: PostQuery = {}) => ['posts', q] as const,
  myPosts: (q: PostQuery = {}) => ['posts', 'mine', q] as const,
  post: (slug: string) => ['post', slug] as const,
  categories: ['categories'] as const,
  category: (slug: string) => ['category', slug] as const,
  comments: (postId: string) => ['comments', postId] as const,
  users: ['users'] as const,
  user: (id: string) => ['user', id] as const,
  /* Social + activity. Keyed by the SUBJECT so a mutation can invalidate only
   * what it touched instead of the whole cache. */
  publicProfile: (id: string) => ['profile', 'public', id] as const,
  followers: (id: string) => ['social', 'followers', id] as const,
  following: (id: string) => ['social', 'following', id] as const,
  likedPosts: (id: string) => ['social', 'likes', id] as const,
  /* Id-only projections of the viewer's own social graph. Lists of full user
   * objects are paginated and heavy; these Sets answer "is this post mine-liked?"
   * and "do I follow this person?" in O(1) for every card on the page. */
  likedIds: (id: string) => ['social', 'liked-ids', id] as const,
  myFollowingIds: ['social', 'following-ids', 'me'] as const,
  myFollowerIds: ['social', 'follower-ids', 'me'] as const,
  notifications: (q: NotificationQuery = {}) => ['notifications', q] as const,
  unread: ['notifications', 'unread'] as const,
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
  const social = useSocialStore();
  return useMutation({
    mutationFn: (p: CreateCommentPayload) => api.createComment(postId, p),
    onSuccess: () => {
      /* The bubble count lives on the feed card and the article rail, neither of
       * which re-renders from a comment-list invalidation — bump the shared
       * store so every copy moves the instant the comment lands. */
      social.bump(postId, { commentCount: 1 });
      qc.invalidateQueries({ queryKey: keys.comments(postId) });
      // The thread count also lives on the post card and the author's stats.
      refreshCounters(qc);
      qc.invalidateQueries({ queryKey: keys.unread }); // commenting notifies the author
    },
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
  const social = useSocialStore();
  return useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: () => {
      social.bump(postId, { commentCount: -1 });
      qc.invalidateQueries({ queryKey: keys.comments(postId) });
      refreshCounters(qc); // the count just went DOWN, everywhere
    },
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

/**
 * Admin edits ANY user through the privileged route (`PATCH /users/:id/admin`),
 * which is the only endpoint accepting `email` and `role`.
 *
 * A role change is not cosmetic: it decides whether the admin links render for
 * that person, so every cached copy of them has to move — the admin table, the
 * single-user cache, their public profile and the viewer's own session if an
 * admin edited themselves.
 */
export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminUpdateUserPayload }) =>
      api.adminUpdateUser(id, payload),
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: keys.users });
      qc.invalidateQueries({ queryKey: keys.user(user.id) });
      qc.invalidateQueries({ queryKey: keys.publicProfile(user.id) });
      qc.invalidateQueries({ queryKey: ['posts'] }); // author byline/name may have changed
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (p: ChangePasswordPayload) => api.changePassword(p) });
}

/* Both uploads carry UPLOAD_TIMEOUT_MS (60s) inside api.ts, so a slow phone on
 * a big file gets a full minute before the UI reports a failure — and when it
 * does, it is a bilingual TimeoutError rather than a generic network error. */
export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadAvatar(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.users });
      qc.invalidateQueries({ queryKey: ['profile', 'public'] }); // avatar shows on the profile header too
    },
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
        // Denormalised counters added to the Post entity for this project —
        // engagement totals come free from the list the dashboard already had.
        likes: items.reduce((sum, p) => sum + (p.likeCount ?? 0), 0),
        comments: items.reduce((sum, p) => sum + (p.commentCount ?? 0), 0),
        recent: items.slice(0, 5),
      };
    },
    enabled,
    staleTime: 30_000,
  });
}

export type { Comment, Post, User, Category };

/* ══════════════════ public profile ══════════════════ */

/**
 * `GET /users/:id/public` — one call for the whole author page.
 * Optional auth: an anonymous visitor still gets a 200, a signed-in one also
 * receives `isFollowing` / `isSelf`.
 */
export function usePublicProfile(
  id: string,
  enabled = true,
  options?: Partial<UseQueryOptions<PublicProfile>>,
) {
  /* SSR-seeded data must be treated as ALREADY STALE.
   *
   * React Query stamps `initialData` as "fetched right now" unless
   * `initialDataUpdatedAt` says otherwise, and with `staleTime: 30_000` that
   * made the server snapshot authoritative for half a minute — no refetch on
   * mount. The server-side fetch carries no token, so its `isFollowing` is
   * always false and its counters are whatever they were at render time: every
   * refresh and every back-navigation appeared to REVERT a follow or a like
   * until the 30 seconds expired. Dating the seed to the epoch keeps the
   * instant, flash-free first paint and still revalidates immediately. */
  const seeded =
    options?.initialData !== undefined && options.initialDataUpdatedAt === undefined
      ? { ...options, initialDataUpdatedAt: 0 }
      : options;

  return useQuery({
    queryKey: keys.publicProfile(id),
    queryFn: () => api.publicProfile(id),
    enabled: !!id && enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    ...seeded,
  });
}

export function useFollowers(id: string, enabled = true) {
  return useQuery({
    queryKey: keys.followers(id),
    queryFn: () => api.followers(id, { limit: 50 }),
    enabled: !!id && enabled,
  });
}

export function useFollowing(id: string, enabled = true) {
  return useQuery({
    queryKey: keys.following(id),
    queryFn: () => api.following(id, { limit: 50 }),
    enabled: !!id && enabled,
  });
}

/** Debounced people search. Disabled until there is a real query string. */
export function useUserSearch(q: string, enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['users', 'search', q] as const,
    queryFn: () => api.searchUsers(q, 20),
    enabled: isAuthenticated && enabled && q.trim().length > 0,
    placeholderData: (prev) => prev,
  });
}

/** Ids of posts the viewer has liked — repairs `likedByMe` on server-rendered
 *  lists, which are fetched WITHOUT a token and therefore always report false. */
export function useLikedPostIds(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: keys.likedIds(id ?? ''),
    queryFn: async () => {
      try {
        return new Set<string>(await api.likedIds(id!));
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
        const ids = new Set<string>();
        let page = 1;
        while (true) {
          const r = await api.likedPosts(id!, { page, limit: 100 });
          for (const p of r.data) ids.add(p.id);
          if (page >= r.meta.totalPages || r.data.length === 0) break;
          page++;
        }
        return ids;
      }
    },
    enabled: !!id && enabled,
    staleTime: 60_000,
  });
}

/** Ids the viewer follows — drives follow-button state in user lists. */
export function useMyFollowingIds(enabled = true) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: keys.myFollowingIds,
    queryFn: async () => {
      const ids = new Set<string>();
      let page = 1;
      while (true) {
        const r = await api.following(user!.id, { page, limit: 100 });
        for (const u of r.data) ids.add(u.id);
        if (page >= r.meta.totalPages || r.data.length === 0) break;
        page++;
      }
      return ids;
    },
    enabled: isAuthenticated && !!user && enabled,
    staleTime: 60_000,
  });
}

/** Ids that follow the viewer — powers the "follows you" / mutual badge. */
export function useMyFollowerIds(enabled = true) {
  const { user, isAuthenticated } = useAuth();
  return useQuery({
    queryKey: keys.myFollowerIds,
    queryFn: async () => {
      const r = await api.followers(user!.id, { limit: 100 });
      return new Set<string>(r.data.map((u) => u.id));
    },
    enabled: isAuthenticated && !!user && enabled,
    staleTime: 60_000,
  });
}

export function useLikedPosts(id: string, enabled = true) {
  return useQuery({
    queryKey: keys.likedPosts(id),
    queryFn: () => api.likedPosts(id, { limit: 48 }),
    enabled: !!id && enabled,
  });
}

/* ══════════════════ follow ══════════════════ */

/**
 * Optimistic follow/unfollow.
 *
 * The button must feel instant, so the UI flips before the request resolves
 * and rolls back on failure. Every place that shows this relationship (profile
 * header, counters, the sidebar's author list) is invalidated on success.
 */
export function useToggleFollow(targetId: string) {
  const qc = useQueryClient();
  const social = useSocialStore();
  const { user: me } = useAuth();
  const profileKey = keys.publicProfile(targetId);
  const myKey = me ? keys.publicProfile(me.id) : null;
  const listKey = me ? keys.following(me.id) : null;

  return useMutation({
    mutationFn: (follow: boolean) =>
      follow ? api.follow(targetId) : api.unfollow(targetId),

    onMutate: async (follow) => {
      const previousFollowing = social.readFollow(targetId) ?? !follow;
      social.begin(`follow:${targetId}`);
      social.setFollowing(targetId, follow);
      await qc.cancelQueries({ queryKey: ['profile', 'public'] });
      await qc.cancelQueries({ queryKey: keys.myFollowingIds });

      /* Snapshot EVERYTHING this mutation touches. Rolling back only the target
       * profile left the viewer's own counters and following-set inflated after
       * a failed request, so the button and the numbers beside it disagreed. */
      const snapshot = {
        previousFollowing,
        target: qc.getQueryData<PublicProfile>(profileKey),
        mine: myKey ? qc.getQueryData<PublicProfile>(myKey) : undefined,
        ids: qc.getQueryData<Set<string>>(keys.myFollowingIds),
        lists: listKey
          ? qc.getQueriesData<{ data: User[]; meta: unknown }>({ queryKey: listKey })
          : ([] as [unknown[], { data: User[]; meta: unknown } | undefined][]),
      };
      /* Paint the button everywhere at once — including on a page we navigate
       * back to later, where Next would otherwise restore the stale payload. */
      social.setFollowing(targetId, follow);

      const prev = snapshot.target;
      if (prev) {
        qc.setQueryData<PublicProfile>(profileKey, {
          ...prev,
          isFollowing: follow,
          stats: {
            ...prev.stats,
            followers: Math.max(0, prev.stats.followers + (follow ? 1 : -1)),
          },
        });
      }

      /* Viewer side, Instagram-style: my own "following" counter moves NOW and
       * the person appears in / disappears from my following list immediately. */
      if (me && myKey) {
        const myPrev = snapshot.mine;
        if (myPrev) {
          qc.setQueryData<PublicProfile>(myKey, {
            ...myPrev,
            stats: {
              ...myPrev.stats,
              following: Math.max(0, myPrev.stats.following + (follow ? 1 : -1)),
            },
          });
        }
        qc.setQueryData<Set<string>>(keys.myFollowingIds, (old) => {
          if (!old) return old;
          const next = new Set(old);
          if (follow) next.add(targetId); else next.delete(targetId);
          return next;
        });
        qc.setQueriesData<{ data: User[]; meta: unknown }>({ queryKey: listKey! }, (old) =>
          old && !follow ? { ...old, data: old.data.filter((u) => u.id !== targetId) } : old,
        );
      }
      return snapshot;
    },

    onError: (_err, follow, snap) => {
      social.setFollowing(targetId, snap?.previousFollowing ?? !follow);
      if (!snap) return;
      if (snap.target !== undefined) qc.setQueryData(profileKey, snap.target);
      if (myKey && snap.mine !== undefined) qc.setQueryData(myKey, snap.mine);
      if (snap.ids !== undefined) qc.setQueryData(keys.myFollowingIds, snap.ids);
      for (const [k, v] of snap.lists) qc.setQueryData(k, v);
    },

    /**
     * Server truth. NOTE: `followState()` reports the TARGET's counters, so
     * `res.followingCount` belongs to them, not to the viewer — writing it into
     * my own stats would show a wrong number. My side is reconciled by the
     * invalidations in onSettled.
     */
    onSuccess: (res) => {
      social.setFollowing(targetId, res.isFollowing);
      qc.setQueryData<PublicProfile>(profileKey, (old) =>
        old
          ? {
              ...old,
              isFollowing: res.isFollowing,
              stats: { ...old.stats, followers: res.followersCount },
            }
          : old,
      );
      qc.setQueryData<Set<string>>(keys.myFollowingIds, (old) => {
        if (!old) return old;
        const next = new Set(old);
        if (res.isFollowing) next.add(targetId);
        else next.delete(targetId);
        return next;
      });
    },

    onSettled: () => {
      social.finish(`follow:${targetId}`);
      /* Wide on purpose: the optimistic patch above only touched the TARGET's
       * profile, but the viewer's own `followingCount` moved too — and that
       * number is rendered in the header, on the viewer's own profile and in
       * any follower list that was already open. */
      qc.invalidateQueries({ queryKey: ['profile', 'public'] });
      qc.invalidateQueries({ queryKey: keys.followers(targetId) });
      qc.invalidateQueries({ queryKey: ['social', 'following'] });
      qc.invalidateQueries({ queryKey: keys.myFollowingIds });
      qc.invalidateQueries({ queryKey: keys.myFollowerIds });
      // A follow creates a notification for the other user.
      qc.invalidateQueries({ queryKey: keys.unread });
    },
  });
}

/* ══════════════════ like ══════════════════ */

/**
 * Optimistic like toggle.
 *
 * `POST /posts/:id/like` is a TOGGLE, so the caller passes the state it wants
 * (`true` = like, `false` = unlike) and the server's `{liked, likeCount}`
 * response is authoritative — it corrects any drift from concurrent likes.
 *
 * `likedByMe` lives on the post object inside whichever list/detail cache is
 * currently rendered, and the post detail page is server-rendered (so its post
 * is NOT in the cache). The optimistic write therefore patches every cached
 * copy of this post id, while the button keeps its own local mirror for the
 * server-rendered case.
 */
export function useToggleLike(postId: string) {
  const qc = useQueryClient();
  const social = useSocialStore();
  const { user: me } = useAuth();
  const likedIdsKey = keys.likedIds(me?.id ?? '');

  /**
   * Keep the viewer's liked-id set in step with the click. Server-rendered
   * pages fetch anonymously, so their `likedByMe` is always false and the only
   * thing that can repaint those hearts is this set.
   */
  const patchIds = (liked: boolean) => {
    if (!me) return;
    qc.setQueryData<Set<string>>(likedIdsKey, (old) => {
      if (!old) return old;
      const next = new Set(old);
      if (liked) next.add(postId);
      else next.delete(postId);
      return next;
    });
  };

  /** Flip likeCount/likedByMe for this post wherever it happens to be cached. */
  const patchEverywhere = (liked: boolean, count?: number) => {
    const flip = <T extends { likeCount?: number; likedByMe?: boolean }>(p: T): T => ({
      ...p,
      likedByMe: liked,
      likeCount: count ?? Math.max(0, (p.likeCount ?? 0) + (liked ? 1 : -1)),
    });

    const patchList = (old: { data: Post[]; meta: unknown } | undefined) =>
      old?.data ? { ...old, data: old.data.map((p) => (p.id === postId ? flip(p) : p)) } : old;

    qc.setQueriesData<{ data: Post[]; meta: unknown }>({ queryKey: ['posts'] }, patchList);
    qc.setQueriesData<{ data: Post[]; meta: unknown }>({ queryKey: ['social', 'likes'] }, patchList);
    qc.setQueriesData<Post>({ queryKey: ['post'] }, (old) => (old && old.id === postId ? flip(old) : old));
  };

  return useMutation({
    mutationFn: (liked: boolean) => {
      return api.toggleLike(postId, liked);
    },

    onMutate: async (liked) => {
      const previous = social.read(postId);
      social.begin(`like:${postId}`);
      social.setLiked(postId, liked);
      await qc.cancelQueries({ queryKey: ['posts'] });
      await qc.cancelQueries({ queryKey: likedIdsKey });
      const prevIds = me ? qc.getQueryData<Set<string>>(likedIdsKey) : undefined;
      patchEverywhere(liked);
      patchIds(liked);
      /* Paint instantly everywhere the count is shown, not just on the button.
       * setLiked is idempotent, so this cannot double-count. */
      social.setLiked(postId, liked);
      return { liked, prevIds, previous };
    },

    // Roll back BOTH the cached post copies and the liked-id set.
    onError: (_e, liked, ctx) => {
      social.apply(postId, { liked: ctx?.previous.liked ?? !liked, likeCount: ctx?.previous.likeCount });
      patchEverywhere(ctx?.previous.liked ?? !liked, ctx?.previous.likeCount);
      if (ctx?.prevIds) qc.setQueryData(likedIdsKey, ctx.prevIds);
      else patchIds(!liked);
    },

    // The server's answer is authoritative and also fixes concurrent drift.
    onSuccess: (res) => {
      social.apply(postId, { liked: res.liked, likeCount: res.likeCount });
      patchEverywhere(res.liked, res.likeCount);
      patchIds(res.liked);
    },

    onSettled: () => {
      social.finish(`like:${postId}`);
      qc.invalidateQueries({ queryKey: ['social', 'likes'] });
      qc.invalidateQueries({ queryKey: ['social', 'liked-ids'] });
      // Liking notifies the author, so the badge may change.
      qc.invalidateQueries({ queryKey: keys.unread });
      /* The optimistic patch already made the button feel instant; this makes
       * the AUTHOR's "likes received" stat and any other cached copy of this
       * post agree with it without a manual refresh. */
      refreshCounters(qc);
    },
  });
}

/* ══════════════════ notifications ══════════════════ */

export function useNotifications(query: NotificationQuery = {}, enabled = true) {
  return useQuery({
    queryKey: keys.notifications(query),
    queryFn: () => api.notifications(query),
    enabled,
    placeholderData: (prev) => prev,
  });
}

/**
 * Unread badge + live toast source.
 *
 * Polled rather than pushed: the backend has no websocket gateway, and the
 * endpoint is `@SkipThrottle()`d so a 30s poll does not eat the request budget.
 * Paused when the tab is hidden or the user is signed out.
 */
export function useUnreadNotifications(enabled = true, refetchMs = 30_000) {
  return useQuery({
    queryKey: keys.unread,
    queryFn: () => api.unreadNotifications(),
    enabled,
    refetchInterval: refetchMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.unread });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.unread });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.unread });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** Type guard kept exported so components can narrow a notification safely. */
export type { Notification, UnreadSummary };

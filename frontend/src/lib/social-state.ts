/** Immutable snapshots. Reads never seed, write, allocate or notify. */
export type PostSocial = { liked: boolean; likeCount: number; commentCount: number };
export const EMPTY_SOCIAL: Readonly<Partial<PostSocial>> = Object.freeze({});

export class SocialStore {
  private posts = new Map<string, Readonly<Partial<PostSocial>>>();
  private follows = new Map<string, boolean>();
  private listeners = new Map<string, Set<() => void>>();
  private pending = new Set<string>();
  private writtenAt = new Map<string, number>();

  subscribe(key: string, listener: () => void): () => void {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, set = new Set());
    set.add(listener);
    return () => { set!.delete(listener); };
  }
  private emit(key: string) { this.listeners.get(key)?.forEach(fn => fn()); }
  read(id: string): Readonly<Partial<PostSocial>> { return this.posts.get(id) ?? EMPTY_SOCIAL; }
  readFollow(id: string): boolean | undefined { return this.follows.get(id); }

  /** A second stale card can only contribute fields that nobody has seeded yet. */
  initialize(id: string, seed: Partial<PostSocial>) {
    const old = this.read(id);
    const missing: Partial<PostSocial> = {};
    for (const k of ['liked', 'likeCount', 'commentCount'] as const) {
      if (old[k] === undefined && seed[k] !== undefined) Object.assign(missing, { [k]: seed[k] });
    }
    this.apply(id, missing);
  }
  initializeFollow(id: string, value: boolean) {
    if (this.readFollow(id) === undefined) this.setFollowing(id, value);
  }
  apply(id: string, patch: Partial<PostSocial>) {
    const old = this.read(id);
    const next = { ...old };
    for (const k of ['liked', 'likeCount', 'commentCount'] as const) {
      if (patch[k] !== undefined) Object.assign(next, { [k]: patch[k] });
    }
    if (next.liked === old.liked && next.likeCount === old.likeCount && next.commentCount === old.commentCount) return;
    this.posts.set(id, Object.freeze(next));
    this.emit(id);
  }
  setLiked(id: string, liked: boolean) {
    const old = this.read(id);
    this.apply(id, {
      liked,
      likeCount: Math.max(0, (old.likeCount ?? 0) + (liked === !!old.liked ? 0 : liked ? 1 : -1)),
    });
  }
  bump(id: string, delta: { likeCount?: number; commentCount?: number }) {
    const old = this.read(id);
    this.apply(id, {
      ...(delta.likeCount === undefined ? {} : { likeCount: Math.max(0, (old.likeCount ?? 0) + delta.likeCount) }),
      ...(delta.commentCount === undefined ? {} : { commentCount: Math.max(0, (old.commentCount ?? 0) + delta.commentCount) }),
    });
  }
  setFollowing(id: string, value: boolean) {
    if (this.readFollow(id) === value) return;
    this.follows.set(id, value);
    this.emit(`follow:${id}`);
  }
  isBusy(key: string) { return this.pending.has(key); }
  begin(key: string) { this.pending.add(key); }
  finish(key: string) { this.pending.delete(key); this.writtenAt.set(key, Date.now()); }
  private canReconcile(key: string, fetchedAt: number) {
    return !this.pending.has(key) && fetchedAt > (this.writtenAt.get(key) ?? 0);
  }
  reconcileLiked(id: string, liked: boolean, fetchedAt: number) {
    if (this.canReconcile(`like:${id}`, fetchedAt)) this.apply(id, { liked });
  }
  reconcileFollow(id: string, following: boolean, fetchedAt: number) {
    // Both true AND false from a fresh authenticated response are authoritative.
    if (this.canReconcile(`follow:${id}`, fetchedAt)) this.setFollowing(id, following);
  }
}

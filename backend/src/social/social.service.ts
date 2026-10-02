import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import { User } from '../user/entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { ERROR_MESSAGES } from '../common/constants/messages';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { AppLoggerService } from '../logger/app-logger.service';

export interface FollowState {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

@Injectable()
export class SocialService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepo: Repository<Follow>,
    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notifications: NotificationService,
    private readonly logger: AppLoggerService,
  ) {}

  private readonly log = this.logger.forContext('SocialService');

  /* ══════════════════════════ FOLLOW ══════════════════════════ */

  /**
   * Follows `followingId`. Idempotent: re-following an already-followed user
   * simply reports the current state instead of throwing.
   */
  async follow(followerId: string, followingId: string): Promise<FollowState> {
    if (followerId === followingId) {
      this.log.warn('Self-follow rejected', { userId: followerId });
      throw new BadRequestException({
        message: {
          en: 'You cannot follow yourself',
          fa: 'نمی‌توانید خودتان را دنبال کنید',
        },
      });
    }
    await this.assertUserExists(followingId);

    const exists = await this.followRepo.exist({
      where: { followerId, followingId },
    });

    if (!exists) {
      // insert().orIgnore() keeps a double-click from hitting the unique index.
      await this.followRepo
        .createQueryBuilder()
        .insert()
        .into(Follow)
        .values({ followerId, followingId })
        .orIgnore()
        .execute();

      await this.notifications.notify({
        userId: followingId,
        actorId: followerId,
        type: NotificationType.FOLLOW,
      }).catch((error) => this.log.error('Follow notification failed', { error: String(error), followingId }));

      this.log.info('User followed', { followerId, followingId });
    }

    return this.followState(followerId, followingId);
  }

  async unfollow(followerId: string, followingId: string): Promise<FollowState> {
    await this.followRepo.delete({ followerId, followingId });
    this.log.info('User unfollowed', { followerId, followingId });
    return this.followState(followerId, followingId);
  }

  /** `viewerId` may be null (anonymous visitor) — then isFollowing is false. */
  async followState(
    viewerId: string | null,
    userId: string,
  ): Promise<FollowState> {
    const [followersCount, followingCount, isFollowing] = await Promise.all([
      this.followRepo.count({ where: { followingId: userId } }),
      this.followRepo.count({ where: { followerId: userId } }),
      viewerId && viewerId !== userId
        ? this.followRepo.exist({ where: { followerId: viewerId, followingId: userId } })
        : Promise.resolve(false),
    ]);
    return { isFollowing, followersCount, followingCount };
  }

  async followers(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<User>> {
    return this.paginateEdges(userId, page, limit, 'followingId', 'follower');
  }

  async following(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<User>> {
    return this.paginateEdges(userId, page, limit, 'followerId', 'following');
  }

  /** Shared paginator for both edge directions. */
  private async paginateEdges(
    userId: string,
    page: number,
    limit: number,
    sideColumn: 'followerId' | 'followingId',
    relation: 'follower' | 'following',
  ): Promise<PaginatedResponse<User>> {
    await this.assertUserExists(userId);

    const [rows, total] = await this.followRepo.findAndCount({
      where: { [sideColumn]: userId } as any,
      relations: [relation],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = rows
      .map((r) => r[relation])
      .filter((u): u is User => !!u);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /* ═══════════════════════════ LIKE ═══════════════════════════ */

  /**
   * Toggles a like and keeps `Post.likeCount` in sync.
   * Returns the new absolute count so the client can render it without a refetch.
   */
  async toggleLike(
    userId: string,
    postId: string,
    desired?: boolean,
  ): Promise<{ liked: boolean; likeCount: number; post: Post }> {
    // Serialize writes for this post. The relationship and counter commit
    // together; an explicit desired state makes retried requests idempotent.
    const result = await this.postRepo.manager.transaction(async (manager) => {
      const posts = manager.getRepository(Post);
      const likes = manager.getRepository(Like);
      const post = await posts.findOne({
        where: { id: postId }, lock: { mode: 'pessimistic_write' },
      });
      if (!post) throw ERROR_MESSAGES.POSTS.postNotFound;
      const existing = await likes.findOne({ where: { userId, postId } });
      const liked = desired ?? !existing;
      if (liked && !existing) await likes.insert({ userId, postId });
      if (!liked && existing) await likes.delete({ id: existing.id });
      // Recount also repairs drift from earlier non-transactional writes.
      const likeCount = await likes.count({ where: { postId } });
      await posts.update(postId, { likeCount });
      return { liked, likeCount, post: { ...post, likeCount } as Post, notify: liked && !existing };
    });
    if (result.notify) {
      // A notification failure must not turn a committed like into an HTTP
      // error: that would make the client roll back data which WAS persisted.
      await this.notifications.notify({
        userId: result.post.authorId, actorId: userId, type: NotificationType.LIKE, postId,
      }).catch((error) => this.log.error('Like notification failed', { error: String(error), postId }));
    }
    this.log.debug('Like state saved', { userId, postId, liked: result.liked, likeCount: result.likeCount });
    return { liked: result.liked, likeCount: result.likeCount, post: result.post };
  }

  async likeState(
    viewerId: string | null,
    postId: string,
  ): Promise<{ liked: boolean; likeCount: number }> {
    const [likeCount, liked] = await Promise.all([
      this.postRepo
        .findOne({ where: { id: postId }, select: ['id', 'likeCount'] })
        .then((p) => p?.likeCount ?? 0),
      viewerId
        ? this.likeRepo.exist({ where: { userId: viewerId, postId } })
        : Promise.resolve(false),
    ]);
    return { liked, likeCount };
  }

  /** Posts the user liked, newest like first. Powers the profile "Likes" tab. */
  async likedPosts(
    userId: string,
    page = 1,
    limit = 12,
    publishedOnly = true,
  ): Promise<PaginatedResponse<Post>> {
    const qb = this.likeRepo
      .createQueryBuilder('like')
      .leftJoinAndSelect('like.post', 'post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.categories', 'categories')
      .where('like.userId = :userId', { userId })
      .orderBy('like.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (publishedOnly) qb.andWhere('post.published = :pub', { pub: true });

    const [rows, total] = await qb.getManyAndCount();
    const data = rows.map((r) => r.post).filter((p): p is Post => !!p);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Batch lookup used by the post list so a feed of N cards costs ONE extra
   * query instead of N (the global throttler makes N+1 fatal here).
   */
  /**
   * EVERY post id the user has liked — one column, no post hydration.
   *
   * The UI needs "did I like this?" for arbitrary posts (including on
   * server-rendered pages whose payload was fetched anonymously). Paging full
   * Post objects for that is both heavy and lossy past the page size, so this
   * returns the exact id set in a single narrow query.
   */
  async allLikedPostIds(userId: string): Promise<string[]> {
    const rows = await this.likeRepo.find({
      where: { userId },
      select: ['postId'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => r.postId);
  }

  async likedPostIds(userId: string | null, postIds: string[]): Promise<string[]> {
    if (!userId || postIds.length === 0) return [];
    const rows = await this.likeRepo.find({
      where: { userId, postId: In(postIds) },
      select: ['postId'],
    });
    return rows.map((r) => r.postId);
  }

  /** Batch follow-state for a list of authors (sidebar / feed personalisation). */
  async followingIds(userId: string | null, authorIds: string[]): Promise<string[]> {
    if (!userId || authorIds.length === 0) return [];
    const rows = await this.followRepo.find({
      where: { followerId: userId, followingId: In(authorIds) },
      select: ['followingId'],
    });
    return rows.map((r) => r.followingId);
  }

  async countsForPosts(postIds: string[]): Promise<Record<string, number>> {
    if (!postIds.length) return {};
    const rows = await this.likeRepo
      .createQueryBuilder('l')
      .select('l.postId', 'postId')
      .addSelect('COUNT(*)', 'count')
      .where('l.postId IN (:...ids)', { ids: postIds })
      .groupBy('l.postId')
      .getRawMany<{ postId: string; count: string }>();
    const out: Record<string, number> = {};
    for (const r of rows) out[r.postId] = Number(r.count);
    return out;
  }

  /* ══════════════════════════ helpers ══════════════════════════ */

  private async assertUserExists(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw ERROR_MESSAGES.USERS.userNotFound;
    return user;
  }

  async removeForPost(postId: string): Promise<void> {
    await this.likeRepo.delete({ postId });
  }

  async removeForUser(userId: string): Promise<void> {
    await Promise.all([
      this.likeRepo.delete({ userId }),
      this.followRepo.delete({ followerId: userId }),
      this.followRepo.delete({ followingId: userId }),
    ]);
  }
}

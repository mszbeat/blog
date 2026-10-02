import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { AppLoggerService } from '../logger/app-logger.service';

/** Minimal shape used when embedding a notification's subject elsewhere. */
export interface NotifyInput {
  userId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  excerpt?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    private readonly logger: AppLoggerService,
  ) {}

  private readonly log = this.logger.forContext('NotificationService');

  /**
   * Fire-and-forget event recorder.
   *
   * Callers (like/follow/comment) must never fail because a notification could
   * not be written, and a user should never be notified about their own action
   * — both are handled here so every call site stays one line.
   */
  async notify(input: NotifyInput): Promise<Notification | null> {
    if (!input.userId || input.userId === input.actorId) return null;

    /* Collapse repeats: if the same actor already produced an unread
     * notification of the same type on the same subject, refresh it instead of
     * stacking duplicates (prevents "5 unread" after an unlike/re-like).
     *
     * `IsNull()` rather than `null`: TypeORM's FindOptionsWhere accepts
     * `string | FindOperator<string> | undefined` — a bare `null` is not one of
     * them, and `undefined` would DROP the predicate entirely (matching every
     * post). IsNull() emits the `IS NULL` we actually want for a follow, which
     * has no post.
     *
     * `commentId` is part of the key too: two DIFFERENT comments are two
     * distinct events, so they must not collapse into one notification — only
     * like/follow (where commentId is null) should dedup. */
    const existing = await this.repo.findOne({
      where: {
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        postId: input.postId ?? IsNull(),
        commentId: input.commentId ?? IsNull(),
        read: false,
      },
      order: { createdAt: 'DESC' },
    });
    if (existing) {
      existing.excerpt = input.excerpt ?? existing.excerpt;
      existing.createdAt = new Date();
      return this.repo.save(existing);
    }

    const row = this.repo.create({
      ...input,
      excerpt: input.excerpt?.slice(0, 160),
    });
    try {
      return await this.repo.save(row);
    } catch (err) {
      /* notify() is fire-and-forget by contract: a like must never 500 because
       * its notification row failed to insert. But "swallow and return null"
       * with no log is how a silently broken notification system survives for
       * weeks — so the failure is recorded even though it is not propagated. */
      this.log.error('Notification write failed (suppressed)', {
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        postId: input.postId,
        commentId: input.commentId,
        error: err,
      });
      return null;
    }
  }

  async findAll(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedResponse<Notification>> {
    const { page = 1, limit = 20, unread, type } = query;

    const qb = this.repo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.actor', 'actor')
      .leftJoinAndSelect('n.post', 'post')
      .leftJoinAndSelect('n.comment', 'comment')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (unread === true) qb.andWhere('n.read = :read', { read: false });
    if (type) qb.andWhere('n.type = :type', { type });

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Cheap count for the header badge — polled by the client. */
  async unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, read: false } });
  }

  /** Per-type breakdown so the UI can show "3 likes · 1 follow". */
  async unreadByType(
    userId: string,
  ): Promise<Record<NotificationType, number>> {
    const rows = await this.repo
      .createQueryBuilder('n')
      .select('n.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('n.userId = :userId AND n.read = false', { userId })
      .groupBy('n.type')
      .getRawMany<{ type: NotificationType; count: string }>();

    const base = {
      [NotificationType.FOLLOW]: 0,
      [NotificationType.LIKE]: 0,
      [NotificationType.COMMENT]: 0,
      [NotificationType.REPLY]: 0,
    } as Record<NotificationType, number>;

    for (const r of rows) base[r.type] = Number(r.count);
    return base;
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    n.read = true;
    return this.repo.save(n);
  }

  async markAllRead(userId: string): Promise<number> {
    const res = await this.repo.update({ userId, read: false }, { read: true });
    return res.affected ?? 0;
  }

  async remove(id: string, userId: string): Promise<void> {
    const res = await this.repo.delete({ id, userId });
    if (!res.affected) throw new NotFoundException('Notification not found');
  }

  /** Delete every notification referencing a post — used when a post is removed. */
  async removeForPost(postId: string): Promise<void> {
    await this.repo.delete({ postId });
  }

  async removeForActor(actorId: string): Promise<void> {
    await this.repo.delete({ actorId });
  }

  async removeForUser(userId: string): Promise<void> {
    await this.repo.delete({
      userId,
    });
  }

  /** Ids of the given posts the user has interacted with (batch helper). */
  async typesForPosts(
    userId: string,
    postIds: string[],
  ): Promise<Record<string, NotificationType[]>> {
    if (!postIds.length) return {};
    const rows = await this.repo.find({
      where: { userId, postId: In(postIds) },
      select: ['postId', 'type'],
    });
    const out: Record<string, NotificationType[]> = {};
    for (const r of rows) {
      if (!r.postId) continue;
      (out[r.postId] ||= []).push(r.type);
    }
    return out;
  }
}

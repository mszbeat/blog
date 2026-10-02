import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { Repository } from 'typeorm';
import { PostService } from '../posts/post.service';
import { UUID } from 'crypto';
import { UserRole } from '../common/enums/user.role';
import { ERROR_MESSAGES } from '../common/constants/messages';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { AppLoggerService } from '../logger/app-logger.service';
import { AuditService } from '../logger/audit.service';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,
    private postService: PostService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLoggerService,
    private readonly audit: AuditService,
  ) {}

  private readonly log = this.logger.forContext('CommentService');

  async create(
    postId: UUID,
    authorId: UUID,
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    const post = await this.postService.findOneById(postId);
    const newComment = this.commentRepo.create({
      ...createCommentDto,
      postId,
      authorId,
    });

    await this.commentRepo.save(newComment);
    await this.postService.bumpCommentCount(postId as string, 1);

    /* Notify everyone who should hear about this, in one pass:
     *   • the post author            → type `comment`
     *   • the parent comment's author → type `reply`   (when it is a reply)
     * `notify()` itself skips the case where actor === recipient, so replying
     * to your own comment does not generate noise. */
    const excerpt = createCommentDto.content.slice(0, 160);

    if (createCommentDto.parentId) {
      const parent = await this.commentRepo.findOne({
        where: { id: createCommentDto.parentId },
      });
      if (parent) {
        await this.notifications.notify({
          userId: parent.authorId,
          actorId: authorId as string,
          type: NotificationType.REPLY,
          postId: postId as string,
          commentId: newComment.id,
          excerpt,
        });
      }
    }

    await this.notifications.notify({
      userId: post.authorId,
      actorId: authorId as string,
      type: NotificationType.COMMENT,
      postId: postId as string,
      commentId: newComment.id,
      excerpt,
    });

    this.log.info('Comment created', {
      commentId: newComment.id,
      postId,
      authorId,
      isReply: !!createCommentDto.parentId,
      parentId: createCommentDto.parentId,
    });
    this.audit.record({
      action: 'CREATE',
      entity: 'comment',
      entityId: newComment.id,
      actorId: authorId as string,
      actorType: 'user',
      metadata: { postId, parentId: createCommentDto.parentId ?? null },
    });

    return newComment;
  }

  async findAll(postId): Promise<Comment[]> {
    await this.postService.findOneById(postId);
    return this.commentRepo.find({
      where: { postId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: UUID): Promise<Comment> {
    const comment = await this.commentRepo.findOneBy({ id });
    if (!comment) {
      throw ERROR_MESSAGES.COMMENTS.commentNotFound;
    }
    return comment;
  }

  async update(
    id: UUID,
    authorId: UUID,
    role: UserRole,
    updateCommentDto: UpdateCommentDto,
  ) {
    const comment = await this.findOne(id);
    if (comment.authorId !== authorId && role !== UserRole.ADMIN) {
      this.log.warn('Comment update denied', { commentId: id, actorId: authorId });
      throw ERROR_MESSAGES.AUTH.accessDenied;
    }
    const before = { content: comment.content };
    Object.assign(comment, updateCommentDto);
    await this.commentRepo.save(comment);

    this.log.info('Comment updated', {
      commentId: id,
      actorId: authorId,
      byAdmin: comment.authorId !== authorId,
    });
    this.audit.record({
      action: 'UPDATE',
      entity: 'comment',
      entityId: id,
      actorId: authorId as string,
      actorType: comment.authorId === authorId ? 'user' : 'admin',
      before,
      after: { content: comment.content },
    });

    return comment;
  }

  async remove(id: UUID, authorId: UUID, role: UserRole): Promise<void> {
    const comment = await this.findOne(id);
    if (comment.authorId !== authorId && role !== UserRole.ADMIN) {
      this.log.warn('Comment delete denied', { commentId: id, actorId: authorId });
      throw ERROR_MESSAGES.AUTH.accessDenied;
    }
    await this.commentRepo.delete(id);
    await this.postService.bumpCommentCount(comment.postId, -1);

    // Deletion is destructive and irreversible, so it is audited at warn with
    // enough context to reconstruct what was removed and by whom.
    this.log.warn('Comment deleted', {
      commentId: id,
      postId: comment.postId,
      ownerId: comment.authorId,
      actorId: authorId,
      byAdmin: comment.authorId !== authorId,
    });
    this.audit.record({
      action: 'DELETE',
      entity: 'comment',
      entityId: id,
      actorId: authorId as string,
      actorType: comment.authorId === authorId ? 'user' : 'admin',
      before: { postId: comment.postId, content: comment.content },
    });
  }
}

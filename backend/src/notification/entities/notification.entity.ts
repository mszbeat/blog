import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comment/entities/comment.entity';

export enum NotificationType {
  FOLLOW = 'follow',
  LIKE = 'like',
  COMMENT = 'comment',
  REPLY = 'reply',
}

/**
 * A single event addressed to one recipient (`userId`), caused by `actorId`.
 *
 * `post` / `comment` are nullable because a follow has neither. They are eager
 * loaded so one query returns everything the notification bell needs to render
 * (actor name+avatar, post title+cover) with no N+1.
 */
@Entity()
@Index(['userId', 'read', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Recipient. */
  @Index()
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  /** Who triggered it. */
  @Column()
  actorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  actor!: User;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ nullable: true })
  postId?: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE', eager: true, nullable: true })
  post?: Post;

  @Column({ nullable: true })
  commentId?: string;

  @ManyToOne(() => Comment, {
    onDelete: 'CASCADE',
    eager: true,
    nullable: true,
  })
  comment?: Comment;

  /** Short preview of the comment/reply text, frozen at creation time so the
   *  bell can show a summary even if the comment is later edited or deleted. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  excerpt?: string;

  @Column({ default: false })
  read!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}

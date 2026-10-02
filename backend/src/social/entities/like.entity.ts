import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';

/**
 * One like per (user, post). `Post.likeCount` is kept as a denormalised
 * counter (same pattern the backend already uses for `viewCount`) so the feed
 * never needs a GROUP BY per card.
 */
@Entity()
@Unique('UQ_like_user_post', ['userId', 'postId'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Index()
  @Column()
  postId!: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  post!: Post;

  @CreateDateColumn()
  createdAt!: Date;
}

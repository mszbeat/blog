import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Category } from '../../categoriy/entities/category.entity';

@Entity()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ unique: true })
  slug!: string;

  @Column('text')
  content!: string;

  @Column({ nullable: true })
  excerpt!: string;

  @Column({ nullable: true })
  coverImage!: string;

  /**
   * Instagram-style gallery: every image attached to the post, in upload order.
   * Rendered as a swipeable carousel on the post page; `coverImage` stays the
   * single thumbnail used by cards and Open Graph.
   *
   * jsonb (not simple-array) so a URL may legally contain commas and so the
   * column round-trips a real array instead of a joined string.
   */
  @Column({ type: 'jsonb', nullable: true })
  images!: string[] | null;

  @Column({ default: false })
  published!: boolean;

  @ManyToOne(() => User, { eager: false })
  author!: User;

  @Column()
  authorId!: string;

  @ManyToMany(() => Category, (category) => category.posts)
  @JoinTable({
    name: 'post_categories',
    joinColumn: { name: 'postId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories!: Category[];

  @Column({ default: 0 })
  viewCount!: number;

  /**
   * Denormalised counters, kept in sync by SocialService/CommentService.
   * Same pattern the entity already uses for `viewCount`: a feed of N cards
   * then costs zero extra queries instead of N COUNT(*) round trips.
   */
  @Column({ default: 0 })
  likeCount!: number;

  @Column({ default: 0 })
  commentCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

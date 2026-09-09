import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';

@Entity()
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  content!: string;

  @ManyToOne(() => User, { eager: true })
  author!: User;

  @Column()
  authorId!: string;

  @ManyToOne(() => Post,{ onDelete: 'CASCADE' })
  post!: Post;

  @Column()
  postId!: string;

  @ManyToOne(() => Comment, (comment) => comment.replies, { nullable: true, onDelete: 'CASCADE' })
  parent!: Comment;

  @Column({ nullable: true })
  parentId!: string;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies!: Comment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

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

/**
 * A directed follow edge: `follower` follows `following`.
 * The unique index is what makes "toggle follow" race-safe — a double click
 * cannot create two rows.
 */
@Entity()
@Unique('UQ_follow_pair', ['followerId', 'followingId'])
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  followerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  follower!: User;

  @Index()
  @Column()
  followingId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  following!: User;

  @CreateDateColumn()
  createdAt!: Date;
}

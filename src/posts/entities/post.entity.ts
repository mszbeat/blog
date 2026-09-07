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
import { CategoriesModule } from '../../categoriy/categories.module';

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
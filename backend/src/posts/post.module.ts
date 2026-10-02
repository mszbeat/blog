import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { Post } from './entities/post.entity';
import { CategoriesModule } from '../categoriy/categories.module';
import { PostCacheService } from './post-cache.service';
import { Like } from '../social/entities/like.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  // `Like` is registered here (rather than importing SocialModule) so the
  // feed can batch-resolve `likedByMe` without a module cycle.
  imports: [
    TypeOrmModule.forFeature([Post, Like]),
    CategoriesModule,
    NotificationModule,
  ],
  controllers: [PostController],
  providers: [PostService, PostCacheService],
  exports: [PostService],
})
export class PostModule {}

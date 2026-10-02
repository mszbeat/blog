import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './entities/follow.entity';
import { Like } from './entities/like.entity';
import { Post } from '../posts/entities/post.entity';
import { User } from '../user/entities/user.entity';
import { SocialService } from './social.service';
import { SocialController } from './social.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Follow, Like, Post, User]),
    NotificationModule,
  ],
  controllers: [SocialController],
  providers: [SocialService],
  // PostService needs likeCount sync on delete; UsersService needs cleanup.
  exports: [SocialService],
})
export class SocialModule {}

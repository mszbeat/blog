import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserCacheService } from './user-cache.service';
import { Post } from '../posts/entities/post.entity';
import { SocialModule } from '../social/social.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Post]), SocialModule],
  controllers: [UsersController],
  providers: [UsersService, UserCacheService],
  exports: [UsersService],
})
export class UsersModule {}

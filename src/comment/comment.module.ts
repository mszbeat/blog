import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { PostModule } from '../posts/post.module';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';
import { Comment } from './entities/comment.entity';
import { CommentManagementController } from './comment-management.controller';

@Module({
  imports: [
    PostModule,
    TypeOrmModule.forFeature([Comment])
  ],
  controllers: [CommentController, CommentManagementController],
  providers: [CommentService],
})
export class CommentModule {}

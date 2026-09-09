import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Res, Req, UseGuards, HttpCode } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UUID } from 'crypto';
import { ResponseDetail } from '../common/interfaces/response';

@Controller('posts/:postId/comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('postId', ParseUUIDPipe) postId: UUID,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req,
  ): Promise<ResponseDetail> {

    const result = await this.commentService.create(postId, req.user.id, createCommentDto);
    return {
      message: {
        en: 'comment created successfuly',
        fa: 'کامنت با موفقیت ساخته شد.'
      },
      data: result
    };
  }

  @Get()
  async findAll(
    @Param('postId') postId: UUID,
  ): Promise<ResponseDetail> {
    const result = await this.commentService.findAll(postId)
    return {
      message: {
        en: 'comments retrieved successfully',
        fa: 'کامت ها با موفقیت بازیابی شد.'
      },
      data: result
    };
  }
}

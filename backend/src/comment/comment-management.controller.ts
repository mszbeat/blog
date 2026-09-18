import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { UUID } from 'crypto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ResponseDetail } from '../common/interfaces/response';

@Controller('comments')
export class CommentManagementController {
  constructor(private commentService: CommentService) {}

  @Patch('/:id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Req() req,
    @Body() updateCommentDto: UpdateCommentDto,
  ): Promise<ResponseDetail> {
    const { id: authorId, role } = req.user;
    const resalt = await this.commentService.update(
      id,
      authorId,
      role,
      updateCommentDto,
    );

    return {
      message: {
        en: 'comment updated successfuly.',
        fa: 'کامنت با موفقیت آپدیت شد.',
      },
      data: resalt,
    };
  }

  @Delete('/:id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: UUID,
    @Req() req,
  ): Promise<ResponseDetail> {
    const { id: authorId, role } = req.user;
    await this.commentService.remove(id, authorId, role);
    return {
      message: {
        fa: 'کامنت با موفقیت حذف شد.',
        en: 'comment removed successfully',
      },
    };
  }
}

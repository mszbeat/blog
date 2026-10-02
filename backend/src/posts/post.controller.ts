import {
  Controller,
  Get,
  Post as HttpPost,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { RESPONSE_MESSAGES } from '../common/constants/messages';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponseDetail } from '../common/interfaces/response';
import { QueryPostsDto } from './dto/query-posts.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @UseGuards(JwtAuthGuard)
  @HttpPost()
  async create(
    @Request() req,
    @Body() createPostDto: CreatePostDto,
  ): Promise<ResponseDetail> {
    const post = await this.postService.create(createPostDto, req.user.id);
    return RESPONSE_MESSAGES.POSTS.create(post);
  }

  /**
   * OptionalJwtAuthGuard: anonymous visitors still get the full list, while a
   * signed-in visitor additionally receives `likedByMe` per post.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Query() query: QueryPostsDto, @Request() req) {
    return this.postService.findAll(query, req.user?.id ?? null);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findMyPosts(@Request() req, @Query() query: QueryPostsDto) {
    return this.postService.findMyPosts(req.user.id, query);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  async findBySlug(
    @Param('slug') slug: string,
    @Request() req,
  ): Promise<ResponseDetail> {
    const post = await this.postService.findBySlug(slug, req.user?.id ?? null);
    return {
      message: {
        fa: 'پست با موفقیت بازیابی شد',
        en: 'Post retrieved successfully',
      },
      data: post,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req,
  ): Promise<ResponseDetail> {
    const post = await this.postService.update(
      id,
      updatePostDto,
      req.user.id,
      req.user.role,
    );
    return {
      message: {
        fa: 'پست با موفقیت به‌روزرسانی شد',
        en: 'Post updated successfully',
      },
      data: post,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @Request() req,
  ): Promise<ResponseDetail> {
    await this.postService.remove(id, req.user.id, req.user.role);
    return {
      message: { fa: 'پست با موفقیت حذف شد', en: 'Post deleted successfully' },
    };
  }
}

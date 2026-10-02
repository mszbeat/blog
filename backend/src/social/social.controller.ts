import { SetLikeDto } from './dto/set-like.dto';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post as HttpPost,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SocialService } from './social.service';
import { ResponseDetail } from '../common/interfaces/response';
import { UserRole } from '../common/enums/user.role';

/**
 * Follow / Like endpoints.
 *
 * Route naming follows the backend's existing convention of putting the
 * resource under its parent (`/users/:id/follow`, `/posts/:id/like`) rather
 * than introducing a new top-level prefix.
 */
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  /* ── Follow ── */

  @UseGuards(JwtAuthGuard)
  @HttpPost('users/:id/follow')
  async follow(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req,
  ): Promise<ResponseDetail> {
    const state = await this.social.follow(req.user.id, id);
    return {
      message: {
        en: 'User followed successfully',
        fa: 'کاربر با موفقیت دنبال شد',
      },
      data: state,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/:id/follow')
  async unfollow(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req,
  ): Promise<ResponseDetail> {
    const state = await this.social.unfollow(req.user.id, id);
    return {
      message: { en: 'User unfollowed successfully', fa: 'دنبال‌کردن لغو شد' },
      data: state,
    };
  }

  /** Public: who follows this user. Optional auth adds `isFollowing`. */
  @Get('users/:id/followers')
  async followers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.social.followers(id, Number(page) || 1, Number(limit) || 20);
  }

  @Get('users/:id/following')
  async following(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.social.following(id, Number(page) || 1, Number(limit) || 20);
  }

  /* ── Like ── */

  /** Toggle (not just "add") so one button can serve like and unlike. */
  @UseGuards(JwtAuthGuard)
  @HttpPost('posts/:postId/like')
  async toggleLike(
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Body() body: SetLikeDto,
    @Req() req,
  ): Promise<ResponseDetail> {
    const { liked, likeCount } = await this.social.toggleLike(
      req.user.id,
      postId,
      body?.liked,
    );
    return {
      message: {
        en: liked ? 'Post liked successfully' : 'Like removed successfully',
        fa: liked ? 'پست لایک شد' : 'لایک برداشته شد',
      },
      data: { liked, likeCount },
    };
  }

  /**
   * Posts a user liked — PRIVATE.
   *
   * This used to be a public route, which meant anyone could enumerate what
   * anybody else had liked. A like list is reading history: it reveals
   * interests the owner never chose to publish, so it is now owner-only (an
   * admin may also read it for moderation). Published-only filtering stays, so
   * an unliked/unpublished post cannot leak through the owner's own tab.
   */
  /**
   * Ids of the posts the user liked — owner-only, same privacy rule as the
   * full list above. Narrow payload, meant for painting heart state.
   */
  @UseGuards(JwtAuthGuard)
  @Get('users/:id/liked-ids')
  async likedIds(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req,
  ): Promise<ResponseDetail> {
    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === UserRole.ADMIN;
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException({
        message: {
          en: 'Liked posts are private',
          fa: 'پست‌های لایک‌شده خصوصی هستند',
        },
      });
    }
    return {
      message: { en: 'Liked post ids', fa: 'شناسه پست‌های لایک‌شده' },
      data: await this.social.allLikedPostIds(id),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:id/likes')
  async likedPosts(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === UserRole.ADMIN;
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException({
        message: {
          en: 'Liked posts are private',
          fa: 'پست‌های لایک‌شده خصوصی هستند',
        },
      });
    }
    return this.social.likedPosts(
      id,
      Number(page) || 1,
      Number(limit) || 12,
      true,
    );
  }
}

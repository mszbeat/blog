import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { ResponseDetail } from '../common/interfaces/response';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  async findAll(
    @Req() req,
    @Query() query: QueryNotificationsDto,
  ): Promise<ResponseDetail> {
    const result = await this.service.findAll(req.user.id, query);
    return {
      message: {
        en: 'Notifications retrieved successfully',
        fa: 'اعلان‌ها با موفقیت بازیابی شدند',
      },
      // Paginated shape is nested under `data` here so the envelope stays
      // consistent with the rest of the API (unlike /post which is bare).
      data: result as unknown as object,
    };
  }

  /**
   * Polled by the client for the live badge + toast, so it is exempt from the
   * global throttler — otherwise a 30s poll would eat the whole 10/min budget.
   */
  @SkipThrottle()
  @Get('unread')
  async unread(@Req() req): Promise<ResponseDetail> {
    const [count, byType] = await Promise.all([
      this.service.unreadCount(req.user.id),
      this.service.unreadByType(req.user.id),
    ]);
    return {
      message: {
        en: 'Unread count retrieved successfully',
        fa: 'تعداد خوانده‌نشده‌ها با موفقیت بازیابی شد',
      },
      data: { count, byType },
    };
  }

  @Patch('read-all')
  async readAll(@Req() req): Promise<ResponseDetail> {
    const affected = await this.service.markAllRead(req.user.id);
    return {
      message: {
        en: 'All notifications marked as read',
        fa: 'همهٔ اعلان‌ها خوانده‌شده شدند',
      },
      data: { affected },
    };
  }

  @Patch(':id/read')
  async read(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req,
  ): Promise<ResponseDetail> {
    const notification = await this.service.markRead(id, req.user.id);
    return {
      message: {
        en: 'Notification marked as read',
        fa: 'اعلان خوانده‌شده شد',
      },
      data: notification,
    };
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req,
  ): Promise<ResponseDetail> {
    await this.service.remove(id, req.user.id);
    return {
      message: {
        en: 'Notification deleted successfully',
        fa: 'اعلان با موفقیت حذف شد',
      },
    };
  }
}

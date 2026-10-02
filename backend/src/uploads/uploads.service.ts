import { Injectable } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersService } from '../user/users.service';
import { AppLoggerService } from '../logger/app-logger.service';
import { AuditService } from '../logger/audit.service';

@Injectable()
export class UploadsService {
  private readonly log = this.logger.forContext('UploadsService');

  constructor(
    private cloudinaryService: CloudinaryService,
    private usersService: UsersService,
    private readonly logger: AppLoggerService,
    private readonly audit: AuditService,
  ) {}

  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    const result = await this.cloudinaryService.uploadImage(
      file,
      'blog/avatars',
    );

    await this.usersService.updateAvatar(userId, result.secure_url);

    this.log.info('Avatar uploaded', {
      userId,
      bytes: file.size,
      mimetype: file.mimetype,
    });
    this.audit.record({
      action: 'UPLOAD_AVATAR',
      entity: 'user',
      entityId: userId,
      actorId: userId,
      actorType: 'user',
      metadata: { bytes: file.size, url: result.secure_url },
    });

    return result.secure_url;
  }

  async uploadCover(
    file: Express.Multer.File,
    userId?: string,
  ): Promise<string> {
    const result = await this.cloudinaryService.uploadImage(
      file,
      'blog/covers',
    );

    this.log.info('Cover uploaded', {
      userId,
      bytes: file.size,
      mimetype: file.mimetype,
    });

    return result.secure_url;
  }
}

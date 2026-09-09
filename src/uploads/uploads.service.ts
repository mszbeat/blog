import { Injectable } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersService } from '../user/users.service';

@Injectable()
export class UploadsService {
  constructor(
    private cloudinaryService: CloudinaryService,
    private usersService: UsersService,
  ) {}

  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<string> {
    const result = await this.cloudinaryService.uploadImage(file, 'blog/avatars');

    // مستقیم آواتار کاربر رو هم آپدیت می‌کنیم
    await this.usersService.updateAvatar(userId, result.secure_url);

    return result.secure_url;
  }

  async uploadCover(file: Express.Multer.File): Promise<string> {
    const result = await this.cloudinaryService.uploadImage(file, 'blog/covers');
    return result.secure_url;
    // توجه: اینجا مستقیم به پست وصل نمی‌کنیم، چون ممکنه کاربر
    // قبل از ساخت پست عکس رو آپلود کنه (مثلاً موقع نوشتن) و بعد URL رو
    // به‌عنوان coverImage توی CreatePostDto بفرسته
  }
}
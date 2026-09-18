import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { multerConfig } from '../common/configs/multer.config';
import { ResponseDetail } from '../common/interfaces/response';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadAvatar(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: '.(png|jpg|jpeg|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req,
  ): Promise<ResponseDetail> {
    const url = await this.uploadsService.uploadAvatar(file, req.user.id);
    return {
      message: {
        fa: 'عکس پروفایل با موفقیت آپلود شد',
        en: 'Avatar uploaded successfully',
      },
      data: { url },
    };
  }

  @Post('cover')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadCover(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: '.(png|jpg|jpeg|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<ResponseDetail> {
    const url = await this.uploadsService.uploadCover(file);
    return {
      message: {
        fa: 'تصویر کاور با موفقیت آپلود شد',
        en: 'Cover image uploaded successfully',
      },
      data: { url },
    };
  }
}

import {
  Injectable,
  BadRequestException,
  GatewayTimeoutException,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { AppLoggerService } from '../logger/app-logger.service';

/**
 * How long an upload is allowed to take before it is abandoned.
 *
 * Cloudinary's own default is 60s but it is applied per-socket and a stalled
 * connection could previously hang indefinitely, leaving the browser spinner
 * running with no server-side deadline at all. One explicit budget here, shared
 * with the frontend's AbortController, means both ends give up at the same
 * moment and the user gets a real message instead of a hung request.
 */
const UPLOAD_TIMEOUT_MS = 60_000;

@Injectable()
export class CloudinaryService {
  private readonly log = this.logger.forContext('CloudinaryService');

  constructor(private readonly logger: AppLoggerService) {}

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadApiResponse> {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      let settled = false;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ width: 1000, height: 1000, crop: 'limit' }],
          timeout: UPLOAD_TIMEOUT_MS,
        },
        (error, result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);

          const durationMs = Date.now() - startedAt;

          if (error || !result) {
            // A timeout is reported distinctly from a rejection: "Cloudinary was
            // slow" and "Cloudinary refused the file" need different responses.
            const isTimeout =
              /timeout|timed out|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(
                String(error?.message ?? ''),
              ) || durationMs >= UPLOAD_TIMEOUT_MS;

            this.log.error('Image upload failed', {
              folder,
              durationMs,
              bytes: file.size,
              mimetype: file.mimetype,
              isTimeout,
              error,
            });

            return reject(
              isTimeout
                ? new GatewayTimeoutException({
                    message: {
                      en: 'Image upload timed out after 60 seconds. Please try again.',
                      fa: 'آپلود تصویر پس از ۶۰ ثانیه ناموفق بود. لطفاً دوباره تلاش کنید.',
                    },
                  })
                : new BadRequestException({
                    message: {
                      en: 'Image upload failed',
                      fa: 'آپلود تصویر ناموفق بود',
                    },
                  }),
            );
          }

          this.log.info('Image uploaded', {
            folder,
            durationMs,
            bytes: file.size,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
          resolve(result);
        },
      );

      // Hard deadline independent of Cloudinary's own socket timeout, so a
      // connection that silently stalls still releases the request.
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        uploadStream.destroy();
        this.log.error('Image upload exceeded deadline', {
          folder,
          durationMs: Date.now() - startedAt,
          bytes: file.size,
        });
        reject(
          new GatewayTimeoutException({
            message: {
              en: 'Image upload timed out after 60 seconds. Please try again.',
              fa: 'آپلود تصویر پس از ۶۰ ثانیه ناموفق بود. لطفاً دوباره تلاش کنید.',
            },
          }),
        );
      }, UPLOAD_TIMEOUT_MS + 5_000);

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
      this.log.info('Image deleted', { publicId });
    } catch (err) {
      // A failed cleanup must not fail the request that triggered it; the orphaned
      // asset is a storage-cost problem, not a correctness one.
      this.log.warn('Image delete failed', { publicId, error: err });
    }
  }
}

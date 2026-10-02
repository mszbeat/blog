import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppLoggerService } from './app-logger.service';

/**
 * Enriches the per-request AsyncLocalStorage scope with application-level
 * identity, and logs the resolved handler for every request.
 *
 * Why an interceptor and not middleware: the `requestLogger` Express middleware
 * opens the ALS scope (requestId/traceId) but runs *before* guards, so it
 * cannot know who the caller is. Interceptors run after guards, which is the
 * first point where `req.user` exists. `Logger.setContext()` patches the active
 * ALS store in place, so `userId` / `role` / `route` end up attached to every
 * log entry emitted later in the same request — including the middleware's own
 * "Request completed" line, whose `res.on('finish')` callback was registered
 * inside that same scope.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    const handler = context.getHandler();
    const controller = context.getClass();
    const route =
      (req.route?.path
        ? `${req.baseUrl ?? ''}${req.route.path}`
        : req.originalUrl) ?? req.url;

    // Bind identity into the ambient scope for the rest of this request.
    const user = (req as Request & { user?: any }).user;
    this.logger.raw.setContext({
      userId: user?.id,
      userRole: user?.role,
      route,
      handler: `${controller.name}.${handler.name}`,
    });

    // Surface the correlation id on the response so the browser/network tab can
    // be matched against server logs when debugging a user-reported issue.
    const requestId = res.getHeader('x-request-id');

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.raw.debug('Handler completed', {
            handler: `${controller.name}.${handler.name}`,
            statusCode: res.statusCode,
            durationMs: elapsedMs(startedAt),
            requestId,
          });
        },
        error: (err: unknown) => {
          // The exception filter produces the authoritative error log; this only
          // records the handler-level failure with timing so slow failures are
          // distinguishable from fast ones.
          this.logger.raw.warn('Handler threw', {
            handler: `${controller.name}.${handler.name}`,
            durationMs: elapsedMs(startedAt),
            errorName: (err as Error)?.name,
            errorMessage: (err as Error)?.message,
          });
        },
      }),
    );
  }
}

function elapsedMs(startedAt: bigint): number {
  return (
    Math.round((Number(process.hrtime.bigint() - startedAt) / 1e6) * 100) / 100
  );
}

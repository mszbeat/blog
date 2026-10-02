import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_MESSAGES } from '../constants/messages';
import type { AppLoggerService } from '../../logger/app-logger.service';

/**
 * Single place where every failed request is both logged and shaped into the
 * API's error envelope.
 *
 * `@Catch()` with no argument means this handles *all* throwables, not just
 * HttpException — an unhandled TypeError in a service would otherwise reach the
 * client as an opaque 500 with nothing in the logs explaining it.
 *
 * Logging and HTTP response shaping deliberately live together here (rather than
 * in a separate Express error middleware) because this is the only point that
 * has both the resolved status code and the original exception object.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger?: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttp ? exception.getResponse() : undefined;

    let message =
      typeof exceptionResponse === 'string'
        ? { en: exceptionResponse, fa: exceptionResponse }
        : (exceptionResponse as any)?.message ||
          (isHttp
            ? exception.message
            : { en: 'Internal server error', fa: 'خطای داخلی سرور' });

    if (status === 429) {
      message = ERROR_MESSAGES.AUTH.throttlerException.message;
    }

    this.log(exception, status, request, message);

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Severity is chosen by status class so log levels stay meaningful:
   *   5xx → error (our fault, needs attention)
   *   4xx → warn  (client fault, useful for spotting abuse/broken clients)
   * Anything not an HttpException is always an error regardless of status.
   */
  private log(
    exception: unknown,
    status: number,
    request: Request,
    message: unknown,
  ): void {
    if (!this.logger) return;

    const fields = {
      method: request.method,
      route: request.originalUrl ?? request.url,
      statusCode: status,
      ip: request.ip,
      userAgent: request.headers?.['user-agent'],
      // Never log the body: it carries credentials on /auth/* and is otherwise
      // unbounded in size.
      responseMessage: message,
      errorName: (exception as Error)?.name,
      errorMessage: (exception as Error)?.message,
    };

    const isHttp = exception instanceof HttpException;

    if (!isHttp || status >= 500) {
      this.logger.raw.error('Request failed', {
        ...fields,
        error: exception,
        stack: (exception as Error)?.stack,
      });
      return;
    }

    // 401/403 are worth a distinct signal: a spike here means credential
    // stuffing or a broken client, not ordinary user error.
    if (status === 401 || status === 403) {
      this.logger.raw.warn('Unauthorized request', fields);
      return;
    }

    this.logger.raw.warn('Request rejected', fields);
  }
}

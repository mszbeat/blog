import {
  Injectable,
  LoggerService,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger, type Logger, type LogFields } from '@silay/logger';
import { buildLoggerOptions } from './logger.config';

/**
 * Application-wide logger built on `@silay/logger`.
 *
 * Implements Nest's `LoggerService`, so `app.useLogger(app.get(AppLoggerService))`
 * routes *every* framework-internal message (bootstrap, router mapping,
 * `Logger` calls from any class, unhandled errors) through the same structured
 * pipeline as our own explicit log calls. That is what makes "log everything"
 * actually hold rather than covering only the places we remembered to instrument.
 *
 * Two ways to use it:
 *   1. `this.logger.forContext(MyService.name).info('msg', { ...fields })`
 *      — returns a child logger with `module` bound, so every entry is tagged.
 *   2. `this.logger.log/error/warn/debug/verbose` — the Nest LoggerService
 *      surface, used automatically by the framework.
 *
 * Request correlation is ambient: the `requestLogger` Express middleware opens
 * an AsyncLocalStorage scope per request, so `requestId` / `traceId` / `userId`
 * are attached to every entry written during that request without threading a
 * context object through the call stack.
 */
@Injectable()
export class AppLoggerService
  implements LoggerService, OnApplicationBootstrap, OnApplicationShutdown
{
  /** The underlying `@silay/logger` instance — exposed for middleware wiring. */
  readonly raw: Logger;

  private readonly childCache = new Map<string, Logger>();

  constructor(private readonly config: ConfigService) {
    this.raw = createLogger(buildLoggerOptions(this.config));
  }

  onApplicationBootstrap(): void {
    this.raw.info('Logger initialised', {
      service: this.config.get<string>('SERVICE_NAME') ?? 'blog-api',
      environment: this.config.get<string>('NODE_ENV') ?? 'development',
      level: this.config.get<string>('LOG_LEVEL') ?? 'debug',
      pid: process.pid,
      nodeVersion: process.version,
    });
  }

  /**
   * Returns a child logger bound to a module/component name. Children are
   * cached because `.child()` allocates a new Logger (sharing the same engine
   * and transports, so this is cheap either way — caching just avoids churn on
   * hot paths).
   */
  forContext(context?: string): Logger {
    if (!context) return this.raw;
    const cached = this.childCache.get(context);
    if (cached) return cached;
    const child = this.raw.child({ module: context });
    this.childCache.set(context, child);
    return child;
  }

  /* ── NestJS LoggerService surface ─────────────────────────────────────── */

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('trace', message, optionalParams);
  }

  /**
   * Nest passes trailing params inconsistently across call sites:
   *   log(msg, context) | error(msg, stack, context) | warn(msg, context)
   * Normalise by treating the last string as the context and any other string
   * as a stack trace, and merging remaining objects as structured fields.
   */
  private emit(
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error',
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const params = [...optionalParams];
    let context: string | undefined;
    let stack: string | undefined;
    const fields: LogFields = {};

    for (let i = params.length - 1; i >= 0; i--) {
      const p = params[i];
      if (typeof p === 'string' && context === undefined && !p.includes('\n')) {
        context = p;
        params.splice(i, 1);
      }
    }
    for (let i = params.length - 1; i >= 0; i--) {
      const p = params[i];
      if (typeof p === 'string' && stack === undefined) {
        stack = p;
        params.splice(i, 1);
      }
    }
    for (const p of params) {
      if (p && typeof p === 'object') Object.assign(fields, p);
    }
    if (stack) fields.stack = stack;

    const logger = this.forContext(context);
    const text = typeof message === 'string' ? message : safeStringify(message);

    if (level === 'error') logger.error(text, fields);
    else logger[level](text, fields);
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  /**
   * Flush buffered writes and close transports on shutdown. Without this,
   * entries still queued in the FileTransport's promise chain are lost when the
   * process exits — exactly the logs you most want after a crash.
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    try {
      this.raw.info('Application shutting down', { signal });
      await this.raw.flush();
      await this.raw.close();
    } catch {
      // Logging must never be the reason shutdown fails.
    }
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppLoggerService } from './app-logger.service';
import { AuditService } from './audit.service';
import { RequestContextInterceptor } from './request-context.interceptor';

/**
 * Global logging module.
 *
 * `@Global()` so every feature module can inject `AppLoggerService` /
 * `AuditService` without re-importing — logging is infrastructure, not a
 * feature, and making each module declare it invites the modules that forget
 * to go unlogged.
 */
@Global()
@Module({
  providers: [
    AppLoggerService,
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
  exports: [AppLoggerService, AuditService],
})
export class LoggerModule {}

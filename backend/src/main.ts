import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common/pipes/validation.pipe';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { errorLogger, requestLogger } from '@silay/logger';
import { AppLoggerService } from './logger/app-logger.service';

async function bootstrap() {
  // bufferLogs: hold Nest's own bootstrap messages until useLogger() below swaps
  // in the structured logger, so nothing from startup is lost or double-formatted.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(AppLoggerService);

  // Route every framework-internal log (bootstrap, router mapping, warnings,
  // errors from any class using Nest's Logger) through @silay/logger.
  app.useLogger(logger);

  // ── Request tracing ────────────────────────────────────────────────────────
  // Registered before app.init(), which is when Nest mounts the router — so this
  // sits ahead of every route. It opens the AsyncLocalStorage scope carrying
  // requestId/traceId, emits one "Request completed" entry per request with
  // method/route/status/durationMs, and echoes x-request-id back to the client
  // so a browser network tab can be matched against server logs.
  //
  // trustProxy stays false: the API is reachable from the public internet, and
  // honouring a client-supplied x-request-id would allow log-correlation spoofing.
  app.use(
    requestLogger(logger.raw, {
      skip: (req: any) =>
        req.url === '/health' || req.url?.startsWith('/api-docs'),
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Blog API')
    .setDescription('API documentation for personal blog project')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Flush + close log transports on SIGTERM/SIGINT so buffered file writes are
  // not lost. The logger's own process-signal handling is disabled in
  // logger.config.ts precisely so this Nest-managed path is the only one.
  app.enableShutdownHooks();

  // Mount the router, then add the Express error sink *after* it so errors that
  // escape route handling (e.g. thrown inside middleware) are still logged.
  await app.init();
  app.use(errorLogger(logger.raw));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  logger.raw.info('HTTP server listening', {
    port,
    env: process.env.NODE_ENV ?? 'development',
    pid: process.pid,
    docs: `/api-docs`,
  });
}

bootstrap().catch((err) => {
  // Last-resort sink: if bootstrap itself fails the DI container may not exist
  // yet, so write straight to stderr and exit non-zero.
  // eslint-disable-next-line no-console
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});

import { ConfigService } from '@nestjs/config';
import type { UserLoggerOptions } from '@silay/logger';

/**
 * Central place where the `@silay/logger` configuration is derived from the
 * environment, so every logger instance in the process (app + audit) shares
 * one consistent, reviewable policy.
 *
 * Precedence (highest first): explicit values below → env vars read by the
 * package itself (LOG_LEVEL / LOG_FORMAT / SERVICE_NAME / LOG_DIR) → the
 * package's per-environment profile defaults.
 *
 * `redact` is deliberately generous: `@silay/logger` already redacts a default
 * set (password, token, authorization, cookie, apiKey, secret, ...) matched
 * case- and separator-insensitively *anywhere* in the object graph. The extra
 * entries below cover this project's own DTO field names so a whole `User`
 * entity or a login body can be logged safely without leaking credentials.
 */
export const EXTRA_REDACT_KEYS = [
  'password',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'oldPassword',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'sessionId',
  'jwt',
  'jwtSecret',
  'x-api-key',
  'cloudinaryApiSecret',
  'dbPassword',
  'user.password',
  'body.password',
  'body.confirmPassword',
  'body.currentPassword',
  'body.newPassword',
  'data.password',
  'data.accessToken',
  'data.refreshToken',
];

export function buildLoggerOptions(
  config: ConfigService,
  overrides: Partial<UserLoggerOptions> = {},
): UserLoggerOptions {
  const env = (config.get<string>('NODE_ENV') ?? 'development').trim();
  const isTest = env === 'test';

  return {
    service: config.get<string>('SERVICE_NAME') ?? 'blog-api',
    environment: env,
    version: config.get<string>('SERVICE_VERSION') ?? '1.0.0',
    level: (config.get<string>('LOG_LEVEL') as any) ?? (isTest ? 'silent' : 'debug'),
    format: (config.get<string>('LOG_FORMAT') as any) ?? (env === 'production' ? 'json' : 'pretty'),
    // Always console; add the rotating file sink everywhere except tests.
    transports: isTest ? ['console'] : ['console', 'file'],
    file: {
      directory: config.get<string>('LOG_DIR') ?? './logs',
      maxSize: config.get<string>('LOG_MAX_SIZE') ?? '20MB',
      maxFiles: Number(config.get<string>('LOG_MAX_FILES') ?? 14),
      retentionDays: Number(config.get<string>('LOG_RETENTION_DAYS') ?? 30),
      compress: true,
    },
    redact: EXTRA_REDACT_KEYS,
    // Nest owns the process lifecycle (`app.enableShutdownHooks()`); letting the
    // logger also register SIGTERM/SIGINT/uncaught handlers would race two
    // shutdown sequences and call process.exit() before Nest has flushed
    // connections. Flush/close happen in onApplicationShutdown instead.
    handleProcessSignals: false,
    ...overrides,
  };
}

import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { attachRedisLogging } from '@silay/logger';
import { AppLoggerService } from '../logger/app-logger.service';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService, AppLoggerService],
      useFactory: (configService: ConfigService, logger: AppLoggerService) => {
        const client = new Redis({
          host: configService.get<string>('REDIS_URL'),
          port: configService.get<number>('REDIS_PORT'),
        });

        // Connection-level events are the ones that actually matter in an
        // incident: a silent reconnect loop looks identical to a healthy client
        // from the request path's point of view.
        const log = logger.forContext('Redis');
        client.on('connect', () => log.debug('Redis connected'));
        client.on('ready', () => log.info('Redis ready'));
        client.on('reconnecting', (ms) =>
          log.warn('Redis reconnecting', { delayMs: ms }),
        );
        client.on('error', (err) => log.error('Redis error', { error: err }));
        client.on('close', () => log.warn('Redis connection closed'));

        // Per-command tracing is opt-in (LOG_REDIS_COMMANDS=true): useful when
        // debugging cache behaviour, far too chatty to leave on by default.
        // The wrapper logs command name + duration only, never argument values,
        // since session keys carry hashed refresh tokens.
        return attachRedisLogging(client, logger.raw, {
          enabled: configService.get<string>('LOG_REDIS_COMMANDS') === 'true',
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

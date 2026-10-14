import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppLoggerService } from '../logger/app-logger.service';

/** Optional data cache. Authentication sessions deliberately do NOT use this. */
@Injectable()
export class DataCacheService {
  readonly enabled: boolean;
  private readonly log = this.logger.forContext('DataCache');
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    config: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    const flag = String(config.get('CACHE_ENABLED') ?? 'true')
      .trim()
      .toLowerCase();
    if (!['true', 'false'].includes(flag))
      throw new Error('CACHE_ENABLED must be true or false');
    this.enabled = flag === 'true';
    this.log.info('Data caching configured', { enabled: this.enabled });
  }
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;
    try {
      const value = await this.redis.get(`cache:v2:${key}`);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.log.warn('Cache read bypassed', { error });
      return null;
    }
  }
  async set(key: string, value: unknown, ttl: number): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.redis.set(`cache:v2:${key}`, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      this.log.warn('Cache write skipped', { error });
    }
  }
  // Keep invalidating while disabled: turning it back on must not resurrect
  // values changed during the bypass period. Never touch session:* keys.
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(`cache:v2:${key}`);
    } catch (error) {
      this.log.warn('Cache invalidation failed', { error });
    }
  }
  async invalidate(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `cache:v2:${pattern}`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (error) {
      this.log.warn('Cache invalidation failed', { error });
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import { User } from './entities/user.entity';
import Redis from 'ioredis';

@Injectable()
export class UserCacheService {
  private readonly expireTimeCache = 86400; // 24 hours in seconds

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  private getKeyId(userId: string): string {
    return `user:${userId}`;
  }

  async createCache(user: User): Promise<void> {
    const { password, ...userWithoutPassword } = user;
    await this.redisClient.set(
      this.getKeyId(user.id),
      JSON.stringify(userWithoutPassword),
      'EX',
      this.expireTimeCache,
    );
  }

  async getById(userId: string): Promise<User | null> {
    const key = this.getKeyId(userId);
    const cachedUser = await this.redisClient.get(key);
    return cachedUser ? (JSON.parse(cachedUser) as User) : null;
  }

  async deleteCache(id: string): Promise<void> {
    await this.redisClient.del(this.getKeyId(id));
  }
}

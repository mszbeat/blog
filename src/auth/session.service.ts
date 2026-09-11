import { Injectable, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { SessionInterface } from './interfaces/session.interface';

@Injectable()
export class SessionService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private configService: ConfigService,
  ) {}

  private getKey(userId: string, sessionId: string): string {
    return `session:${userId}:${sessionId}`;
  }

  async saveSession(
    userId: string,
    sessionId: string,
    refreshToken: string,
    meta: { ip?: string; userAgent?: string },
    ttlSeconds: number,
  ): Promise<string> {
    const session: SessionInterface = {
      userId,
      refreshToken: await bcrypt.hash(refreshToken, 10),
      createdAt: new Date(),
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    };
    const key = this.getKey(userId, sessionId);
    await this.redisClient.set(key, JSON.stringify(session), 'EX', ttlSeconds);
    return sessionId;
  }

  async validateSession(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<boolean> {
    const key = this.getKey(userId, sessionId);
    const sessionData = await this.redisClient.get(key);
    if (!sessionData) {
      return false;
    }

    const session: SessionInterface = JSON.parse(sessionData);
    const isValid = await bcrypt.compare(refreshToken, session.refreshToken);
    return isValid;
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const key = this.getKey(userId, sessionId);
    await this.redisClient.del(key);
  }

  async deleteAllSessionsForUser(userId: string): Promise<void> {
    const keys = await this.redisClient.keys(`session:${userId}:*`);
    if (keys.length > 0) {
      await this.redisClient.del(keys);
    }
  }

  async getUserSessions(userId: string): Promise<SessionInterface[]> {
    const keys = await this.redisClient.keys(`session:${userId}:*`);
    if (keys.length === 0) {
      return [];
    }

    const values = await this.redisClient.mget(keys);
    return values
      .filter(Boolean)
      .map((value) => JSON.parse(value as string) as SessionInterface);
  }

  async sessionExists(userId: string, sessionId: string): Promise<boolean> {
    const exists = await this.redisClient.exists(
      this.getKey(userId, sessionId),
    );
    return exists === 1;
  }
}

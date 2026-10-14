import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { DataCacheService } from '../redis/data-cache.service';

@Injectable()
export class UserCacheService {
  constructor(private readonly cache: DataCacheService) {}
  createCache(user: User): Promise<void> {
    const { password, ...safeUser } = user;
    return this.cache.set(`user:${user.id}`, safeUser, 86400);
  }
  getById(id: string) {
    return this.cache.get<User>(`user:${id}`);
  }
  deleteCache(id: string) {
    return this.cache.delete(`user:${id}`);
  }
}

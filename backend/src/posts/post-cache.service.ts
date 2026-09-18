import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Post } from './entities/post.entity';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import Redis from 'ioredis';
import { QueryPostsDto } from './dto/query-posts.dto';

@Injectable()
export class PostCacheService {
  private readonly singlePostTTL = 3600;
  private readonly listTTL = 300;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  private getSlugKey(slug: string): string {
    return `post:slug:${slug}`;
  }

  async cachePost(post: Post): Promise<void> {
    await this.redisClient.set(
      this.getSlugKey(post.slug),
      JSON.stringify(post),
      'EX',
      this.singlePostTTL,
    );
  }

  async getPostBySlug(slug: string): Promise<Post | null> {
    const cached = await this.redisClient.get(this.getSlugKey(slug));
    return cached ? (JSON.parse(cached) as Post) : null;
  }

  async deletePostCache(slug: string): Promise<void> {
    await this.redisClient.del(this.getSlugKey(slug));
  }

  private getListKey(queryString: string): string {
    return `posts:list:${queryString}`;
  }

  async cacheList(
    query: QueryPostsDto,
    data: PaginatedResponse<Post>,
  ): Promise<void> {
    await this.redisClient.set(
      this.getListKey(JSON.stringify(query)),
      JSON.stringify(data),
      'EX',
      this.listTTL,
    );
  }

  async getList(
    queryString: QueryPostsDto,
  ): Promise<PaginatedResponse<Post> | null> {
    const cached = await this.redisClient.get(
      this.getListKey(JSON.stringify(queryString)),
    );
    return cached ? (JSON.parse(cached) as PaginatedResponse<Post>) : null;
  }

  async invalidateAllLists(): Promise<void> {
    const keys = await this.redisClient.keys('posts:list:*');
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }
}

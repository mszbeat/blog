import { Injectable } from '@nestjs/common';
import { Post } from './entities/post.entity';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { QueryPostsDto } from './dto/query-posts.dto';
import { DataCacheService } from '../redis/data-cache.service';

@Injectable()
export class PostCacheService {
  constructor(private readonly cache: DataCacheService) {}
  cachePost(post: Post) {
    return this.cache.set(`post:slug:${post.slug}`, post, 3600);
  }
  getPostBySlug(slug: string) {
    return this.cache.get<Post>(`post:slug:${slug}`);
  }
  deletePostCache(slug: string) {
    return this.cache.delete(`post:slug:${slug}`);
  }
  cacheList(query: QueryPostsDto, data: PaginatedResponse<Post>) {
    return this.cache.set(`posts:list:${JSON.stringify(query)}`, data, 300);
  }
  getList(query: QueryPostsDto) {
    return this.cache.get<PaginatedResponse<Post>>(
      `posts:list:${JSON.stringify(query)}`,
    );
  }
  invalidateAllLists() {
    return this.cache.invalidate('posts:list:*');
  }
}

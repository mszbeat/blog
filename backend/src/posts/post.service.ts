import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { slugify } from '../common/utilities/slug.util';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { UserRole } from '../common/enums/user.role';
import { ERROR_MESSAGES } from '../common/constants/messages';
import { CategoryService } from '../categoriy/categories.service';
import { PostCacheService } from './post-cache.service';
import { Like } from '../social/entities/like.entity';
import { NotificationService } from '../notification/notification.service';
import { AppLoggerService } from '../logger/app-logger.service';
import { AuditService } from '../logger/audit.service';

/** A post plus the signed-in viewer's relationship to it. */
export type PostWithViewer = Post & { likedByMe?: boolean };

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private postsRepo: Repository<Post>,
    @InjectRepository(Like)
    private likesRepo: Repository<Like>,
    private categoriesService: CategoryService,
    private postCacheService: PostCacheService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLoggerService,
    private readonly audit: AuditService,
  ) {}

  private readonly log = this.logger.forContext('PostService');

  async create(createPostDto: CreatePostDto, authorId: string): Promise<Post> {
    const { categories, ...postData } = createPostDto;
    const slug = await this.generateUniqueSlug(postData.title);

    const post = this.postsRepo.create({
      ...postData,
      slug,
      authorId,
    });

    if (categories && categories.length > 0) {
      post.categories = await this.categoriesService.findByIds(categories);
    }

    const savedPost = await this.postsRepo.save(post);

    await this.postCacheService.invalidateAllLists();

    this.log.info('Post created', {
      postId: savedPost.id,
      slug: savedPost.slug,
      authorId,
      published: savedPost.published,
      categories: post.categories?.length ?? 0,
    });
    this.audit.record({
      action: 'CREATE',
      entity: 'post',
      entityId: savedPost.id,
      actorId: authorId,
      actorType: 'user',
      after: { slug: savedPost.slug, published: savedPost.published },
    });

    return savedPost;
  }

  async findAll(
    query: QueryPostsDto,
    viewerId?: string | null,
  ): Promise<PaginatedResponse<PostWithViewer>> {
    const { page = 1, limit = 10, published, category, author } = query;
    const cachedList = await this.postCacheService.getList(query);
    if (cachedList) {
      // Cache content, never viewer state or live counters.
      const data = await this.withViewerState(cachedList.data, viewerId);
      return { ...cachedList, data };
    }

    const queryBuilder = this.postsRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.categories', 'categories')
      .where('post.published = :published', { published: published ?? true })
      .orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (category) {
      queryBuilder.andWhere('categories.slug = :category', { category });
    }

    // Lets a public profile page paginate an author's posts server-side
    // instead of the client pulling everything and filtering in memory.
    if (author) {
      queryBuilder.andWhere('post.authorId = :author', { author });
    }

    const [rows, total] = await queryBuilder.getManyAndCount();

    const meta = { total, page, limit, totalPages: Math.ceil(total / limit) };
    // Cache the anonymous shape; viewer state is stamped per-request below so
    // one user's "likedByMe" can never leak into another user's cached page.
    await this.postCacheService.cacheList(query, { data: rows, meta });

    const data = await this.withViewerState(rows, viewerId);
    return { data, meta };
  }

  /**
   * Stamps `likedByMe` on a batch of posts with a SINGLE query.
   * Doing this per card would be N+1 — fatal under the global throttler.
   */
  private async withViewerState(
    posts: Post[],
    viewerId?: string | null,
  ): Promise<PostWithViewer[]> {
    if (posts.length === 0) return [];
    const ids = posts.map((p) => p.id);
    // One narrow batch read, including on Redis hits. Old Redis entries remain
    // safe: their counters are overwritten with database truth on EVERY read.
    const [fresh, likes] = await Promise.all([
      this.postsRepo.find({
        where: { id: In(ids) },
        select: ['id', 'likeCount', 'commentCount', 'viewCount'],
      }),
      viewerId
        ? this.likesRepo.find({
            where: { userId: viewerId, postId: In(ids) },
            select: ['postId'],
          })
        : Promise.resolve([]),
    ]);
    const counts = new Map(fresh.map((p) => [p.id, p]));
    const likedIds = new Set(likes.map((l) => l.postId));
    return posts
      .filter((p) => counts.has(p.id))
      .map((p) => ({
        ...p,
        ...counts.get(p.id),
        likedByMe: likedIds.has(p.id),
      }));
  }

  async findMyPosts(
    authorId: string,
    query: QueryPostsDto,
  ): Promise<PaginatedResponse<Post>> {
    const { page = 1, limit = 10 } = query;

    const [data, total] = await this.postsRepo.findAndCount({
      where: { authorId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(
    slug: string,
    viewerId?: string | null,
  ): Promise<PostWithViewer> {
    const cached = await this.postCacheService.getPostBySlug(slug);
    if (cached) {
      await this.postsRepo.increment({ id: cached.id }, 'viewCount', 1);
      const [stamped] = await this.withViewerState([cached], viewerId);
      return stamped;
    }

    const post = await this.postsRepo.findOne({
      where: { slug },
      relations: ['author', 'categories'],
    });

    if (!post) {
      throw ERROR_MESSAGES.POSTS.postNotFound;
    }

    await this.postsRepo.increment({ id: post.id }, 'viewCount', 1);

    await this.postCacheService.cachePost(post);

    const [stamped] = await this.withViewerState([post], viewerId);
    return stamped;
  }

  /**
   * Keeps the denormalised `commentCount` in sync. Clamped at zero so an
   * already-deleted comment can never push the counter negative.
   */
  async bumpCommentCount(postId: string, delta: number): Promise<void> {
    if (delta > 0) {
      await this.postsRepo.increment({ id: postId }, 'commentCount', delta);
      return;
    }
    await this.postsRepo
      .createQueryBuilder()
      .update(Post)
      .set({ commentCount: () => 'GREATEST("commentCount" - 1, 0)' })
      .where('id = :id', { id: postId })
      .execute();
  }

  async bumpLikeCount(postId: string, delta: number): Promise<void> {
    if (delta > 0) {
      await this.postsRepo.increment({ id: postId }, 'likeCount', delta);
      return;
    }
    await this.postsRepo
      .createQueryBuilder()
      .update(Post)
      .set({ likeCount: () => 'GREATEST("likeCount" - 1, 0)' })
      .where('id = :id', { id: postId })
      .execute();
  }

  async findOneById(id: string): Promise<Post> {
    const post = await this.postsRepo.findOne({
      where: { id },
      relations: ['author', 'categories'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ): Promise<Post> {
    const post = await this.findOneById(id);
    this.checkOwnership(post, currentUserId, currentUserRole);

    const { categories, ...postData } = updatePostDto;

    if (postData.title && postData.title !== post.title) {
      post.slug = await this.generateUniqueSlug(postData.title);
    }

    if (categories) {
      post.categories = await this.categoriesService.findByIds(categories);
    }

    const before = {
      title: post.title,
      slug: post.slug,
      published: post.published,
    };
    Object.assign(post, postData);
    const updatedPost = await this.postsRepo.save(post);

    await Promise.all([
      this.postCacheService.deletePostCache(before.slug),
      this.postCacheService.invalidateAllLists(),
    ]);

    this.log.info('Post updated', {
      postId: id,
      actorId: currentUserId,
      fields: Object.keys(postData),
    });
    this.audit.record({
      action: 'UPDATE',
      entity: 'post',
      entityId: id,
      actorId: currentUserId,
      actorType: post.authorId === currentUserId ? 'user' : 'admin',
      before,
      after: {
        title: updatedPost.title,
        slug: updatedPost.slug,
        published: updatedPost.published,
      },
    });

    return updatedPost;
  }

  async remove(
    id: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ): Promise<void> {
    const post = await this.findOneById(id);

    this.checkOwnership(post, currentUserId, currentUserRole);

    await this.postsRepo.delete({ id });

    // Likes cascade at the DB level, but notifications referencing this post
    // would otherwise dangle in the bell with a dead link.
    await Promise.all([
      this.postCacheService.deletePostCache(post.slug),
      this.postCacheService.invalidateAllLists(),
      this.notifications.removeForPost(id),
    ]);

    this.log.warn('Post deleted', {
      postId: id,
      slug: post.slug,
      actorId: currentUserId,
      wasOwner: post.authorId === currentUserId,
    });
    this.audit.record({
      action: 'DELETE',
      entity: 'post',
      entityId: id,
      actorId: currentUserId,
      actorType: post.authorId === currentUserId ? 'user' : 'admin',
      before: { slug: post.slug, title: post.title, authorId: post.authorId },
    });
  }

  private checkOwnership(
    post: Post,
    currentUserId: string,
    currentUserRole: UserRole,
  ): void {
    const isOwner = post.authorId === currentUserId;
    const isAdmin = currentUserRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      // A denied write on someone else's content is the signal worth keeping:
      // it distinguishes a broken client from someone probing for access.
      this.log.warn('Post modification denied', {
        postId: post.id,
        authorId: post.authorId,
        actorId: currentUserId,
        actorRole: currentUserRole,
      });
      this.audit.record({
        action: 'MODIFY_DENIED',
        entity: 'post',
        entityId: post.id,
        actorId: currentUserId,
        actorType: 'user',
        metadata: { reason: 'not_owner' },
      });
      throw new ForbiddenException('You are not allowed to modify this post');
    }
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const baseSlug = slugify(title);
    let slug = baseSlug;
    let counter = 1;

    while (await this.postsRepo.exist({ where: { slug } })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { QueryPostsDto } from './dto/query-posts.dto';
import { slugify } from '../common/utilities/slug.util';
import { PaginatedResponse } from '../common/interfaces/paginated-response.interface';
import { UserRole } from '../common/enums/user.role';
import { CategoryService } from '../categoriy/categories.service';
import { PostCacheService } from './post-cache.service';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private postsRepo: Repository<Post>,
    private categoriesService: CategoryService,
    private postCacheService: PostCacheService,
  ) {}

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

    return savedPost;
  }

  async findAll(query: QueryPostsDto): Promise<PaginatedResponse<Post>> {
    const { page = 1, limit = 10, published, category } = query;
    const cachedList = await this.postCacheService.getList(query);
    if (cachedList) {
      return cachedList;
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

    const [data, total] = await queryBuilder.getManyAndCount();

    const meta = { total, page, limit, totalPages: Math.ceil(total / limit) };
    await this.postCacheService.cacheList(query, { data, meta });

    return {
      data,
      meta,
    };
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

  async findBySlug(slug: string): Promise<Post> {
    const cached = await this.postCacheService.getPostBySlug(slug);
    if (cached) {
      this.postsRepo.increment({ id: cached.id }, 'viewCount', 1);
      return cached;
    }

    const post = await this.postsRepo.findOne({
      where: { slug },
      relations: ['author', 'categories'],
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    this.postsRepo.increment({ id: post.id }, 'viewCount', 1);

    await this.postCacheService.cachePost(post);

    return post;
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

    Object.assign(post, postData);
    const updatedPost = await this.postsRepo.save(post);

    await Promise.all([
      this.postCacheService.deletePostCache(post.slug),
      this.postCacheService.invalidateAllLists(),
    ]);

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

    await Promise.all([
      this.postCacheService.deletePostCache(post.slug),
      this.postCacheService.invalidateAllLists(),
    ]);
  }

  private checkOwnership(
    post: Post,
    currentUserId: string,
    currentUserRole: UserRole,
  ): void {
    const isOwner = post.authorId === currentUserId;
    const isAdmin = currentUserRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
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

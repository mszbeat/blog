import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { Repository } from 'typeorm';
import { PostService } from '../posts/post.service';
import { UUID } from 'crypto';
import { UserRole } from '../common/enums/user.role';
import { promises } from 'dns';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private commentRepo: Repository<Comment>,
    private postService: PostService
  ) { }

  async create(postId: UUID, authorId: UUID, createCommentDto: CreateCommentDto): Promise<Comment> {
    await this.postService.findOneById(postId);
    const newComment = this.commentRepo.create({
      ...createCommentDto,
      postId,
      authorId
    })

    await this.commentRepo.save(newComment);
    return newComment;
  }

  async findAll(postId): Promise<Comment[]> {
    await this.postService.findOneById(postId);
    return this.commentRepo.find({ where:{postId}, order:{createdAt:'DESC'} });
  }

  async findOne(id: UUID): Promise<Comment> {
    const comment = await this.commentRepo.findOneBy({ id })
    if (!comment) {
      throw new NotFoundException(`کامنتی با id ${id} یافت نشد.`)
    }
    return comment;
  }

  async update(id: UUID, authorId: UUID, role: UserRole, updateCommentDto: UpdateCommentDto) {
    const comment = await this.findOne(id);
    if (comment.authorId !== authorId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('access denied.')
    }
    Object.assign(comment, updateCommentDto);
    await this.commentRepo.save(comment);

    return comment;
  }

  async remove(id: UUID, authorId: UUID, role: UserRole): Promise<void> {
    const comment = await this.findOne(id);
    if (comment.authorId !== authorId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('access denied.')
    }
    await this.commentRepo.delete(id);
  }
}

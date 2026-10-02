import { Injectable, ForbiddenException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { User } from './entities/user.entity';
import { Repository, ILike } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ERROR_MESSAGES } from '../common/constants/messages';
import { UserCacheService } from './user-cache.service';
import { Post } from '../posts/entities/post.entity';
import { PublicProfile } from './dto/public-profile.dto';
import type { SocialService } from '../social/social.service';
import { AppLoggerService } from '../logger/app-logger.service';
import { AuditService } from '../logger/audit.service';
import { UserRole } from '../common/enums/user.role';

@Injectable()
export class UsersService {
  private readonly log = this.logger.forContext('UsersService');

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,

    @InjectRepository(Post)
    private postsRepo: Repository<Post>,

    private readonly userCacheService: UserCacheService,
    private readonly logger: AppLoggerService,
    private readonly audit: AuditService,
  ) {}

  /**
   * People search for the follow flow: case-insensitive substring match on name
   * or email handle, alphabetised, capped. Returns full User records (password
   * is @Exclude'd) so the frontend can render follow buttons directly.
   */
  async search(q: string, limit = 20): Promise<User[]> {
    const term = `%${(q ?? '').trim()}%`;
    this.log.info('User search', { q: (q ?? '').trim(), limit });
    return this.usersRepo.find({
      where: [{ name: ILike(term) }, { email: ILike(term) }],
      order: { name: 'ASC' },
      take: Math.min(Math.max(1, limit || 20), 50),
    });
  }

  async create(createUserDto: CreateUserDto, actorId?: string): Promise<User> {
    const existingUser = await this.usersRepo.exist({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      this.log.warn('Registration blocked: email already taken', {
        email: createUserDto.email,
      });
      throw ERROR_MESSAGES.USERS.emailAlreadyExists;
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = this.usersRepo.create({
      ...createUserDto,
      password: hashedPassword,
    });
    await this.usersRepo.save(newUser);

    await this.userCacheService.createCache(newUser);

    this.log.info('User created', {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      createdBy: actorId ?? 'self-registration',
    });
    this.audit.record({
      action: 'CREATE',
      entity: 'user',
      entityId: newUser.id,
      actorId: actorId ?? newUser.id,
      actorType: actorId ? 'admin' : 'system',
      after: { email: newUser.email, role: newUser.role, name: newUser.name },
    });

    return newUser;
  }

  findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  /**
   * Reads through the Redis cache, but the cache intentionally stores the user
   * WITHOUT the password hash — so anything that needs to verify a password
   * must use `findOneByIdWithPassword()` instead. Mixing the two is what made
   * `changePassword` throw `bcrypt.compare(x, undefined)`.
   */
  async findOneById(id: string): Promise<User> {
    const cachedUser = await this.userCacheService.getById(id);
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    await this.userCacheService.createCache(user);
    return user;
  }

  /** Bypasses the cache deliberately — credential checks need the real hash. */
  async findOneByIdWithPassword(id: string): Promise<User> {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }
    return user;
  }

  /**
   * Aggregates everything a public profile page needs in one round trip:
   * the user, their published-post stats, follow counts, and — when the
   * caller is signed in — whether the viewer already follows them.
   *
   * `SocialService` is passed in rather than injected to avoid a circular
   * module dependency (Social already depends on the User entity).
   */
  async getPublicProfile(
    id: string,
    viewerId: string | null,
    social: SocialService,
  ): Promise<PublicProfile> {
    const user = await this.findOneById(id);

    const [postAgg, followState] = await Promise.all([
      this.postsRepo
        .createQueryBuilder('post')
        .select('COUNT(*)', 'posts')
        .addSelect('COALESCE(SUM(post.viewCount), 0)', 'views')
        .addSelect('COALESCE(SUM(post.likeCount), 0)', 'likes')
        .where('post.authorId = :id AND post.published = :pub', {
          id,
          pub: true,
        })
        .getRawOne<{ posts: string; views: string; likes: string }>(),
      social.followState(viewerId, id),
    ]);

    return {
      user,
      stats: {
        posts: Number(postAgg?.posts ?? 0),
        views: Number(postAgg?.views ?? 0),
        likes: Number(postAgg?.likes ?? 0),
        followers: followState.followersCount,
        following: followState.followingCount,
      },
      isFollowing: followState.isFollowing,
      isSelf: viewerId === id,
    };
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOneBy({ email });
  }

  /**
   * Self-service profile update.
   *
   * Ownership is enforced HERE rather than only in the controller so the rule
   * holds for every future caller (admin tooling, scripts, tests). An admin may
   * still update someone else's profile, but only through `adminUpdate()` —
   * this path accepts no privileged fields at all, because UpdateUserDto does
   * not declare `role` or `email`.
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    actor: { id: string; role?: UserRole },
  ) {
    const isSelf = actor.id === id;
    const isAdmin = actor.role === UserRole.ADMIN;
    if (!isSelf && !isAdmin) {
      this.log.warn('Profile update denied: not the owner', {
        targetUserId: id,
        actorId: actor.id,
      });
      this.audit.record({
        action: 'UPDATE_DENIED',
        entity: 'user',
        entityId: id,
        actorId: actor.id,
        actorType: 'user',
        metadata: { reason: 'not_owner' },
      });
      throw new ForbiddenException({
        message: {
          en: 'You can only edit your own profile',
          fa: 'فقط می‌توانید پروفایل خودتان را ویرایش کنید',
        },
      });
    }

    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    const before = { name: user.name, bio: user.bio, avatar: user.avatar };
    Object.assign(user, updateUserDto);
    const updatedUser = await this.usersRepo.save(user);
    await this.userCacheService.deleteCache(id);
    await this.userCacheService.createCache(updatedUser);

    this.log.info('Profile updated', {
      userId: id,
      actorId: actor.id,
      self: isSelf,
      fields: Object.keys(updateUserDto),
    });
    this.audit.record({
      action: 'UPDATE',
      entity: 'user',
      entityId: id,
      actorId: actor.id,
      actorType: isSelf ? 'user' : 'admin',
      before,
      after: {
        name: updatedUser.name,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
      },
    });

    return updatedUser;
  }

  /**
   * Admin-only update — the sole path that can write `role` and `email`.
   *
   * Role changes are logged at `warn` and audited with before/after, because
   * granting admin is the single highest-impact action available in this API.
   */
  async adminUpdate(
    id: string,
    dto: AdminUpdateUserDto,
    actor: { id: string; role?: UserRole },
  ) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        message: {
          en: 'Only an administrator can perform this action',
          fa: 'فقط مدیر می‌تواند این کار را انجام دهد',
        },
      });
    }

    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    if (dto.email && dto.email !== user.email) {
      const taken = await this.usersRepo.exist({
        where: { email: dto.email },
      });
      if (taken) {
        this.log.warn('Admin update blocked: email already taken', {
          targetUserId: id,
          email: dto.email,
          actorId: actor.id,
        });
        throw ERROR_MESSAGES.USERS.emailAlreadyExists;
      }
    }

    const before = {
      name: user.name,
      email: user.email,
      bio: user.bio,
      avatar: user.avatar,
      role: user.role,
    };

    const roleChanged = dto.role !== undefined && dto.role !== user.role;
    Object.assign(user, dto);
    const updated = await this.usersRepo.save(user);

    /* Invalidate rather than refresh: the cached copy carries a 24h TTL and is
     * what JwtStrategy.validate() reads on EVERY authenticated request. Leaving
     * it in place would mean a demoted admin keeps admin rights — and a promoted
     * user keeps getting 403s — for up to a day. */
    await this.userCacheService.deleteCache(id);

    if (roleChanged) {
      this.log.warn('User role changed by admin', {
        targetUserId: id,
        from: before.role,
        to: updated.role,
        actorId: actor.id,
      });
    } else {
      this.log.info('User updated by admin', {
        targetUserId: id,
        actorId: actor.id,
        fields: Object.keys(dto),
      });
    }

    this.audit.record({
      action: roleChanged ? 'CHANGE_ROLE' : 'ADMIN_UPDATE',
      entity: 'user',
      entityId: id,
      actorId: actor.id,
      actorType: 'admin',
      before,
      after: {
        name: updated.name,
        email: updated.email,
        bio: updated.bio,
        avatar: updated.avatar,
        role: updated.role,
      },
    });

    return updated;
  }

  async remove(id: string, actor?: { id: string; role?: UserRole }): Promise<void> {
    const user = await this.findOneById(id);
    await this.usersRepo.delete({ id });
    await this.userCacheService.deleteCache(id);

    this.log.warn('User deleted', {
      targetUserId: id,
      email: user.email,
      actorId: actor?.id,
    });
    this.audit.record({
      action: 'DELETE',
      entity: 'user',
      entityId: id,
      actorId: actor?.id,
      actorType: 'admin',
      before: { email: user.email, role: user.role, name: user.name },
    });
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    // Must NOT go through findOneById(): the Redis cache strips `password`, so
    // bcrypt.compare would receive undefined and throw on every attempt.
    const user = await this.findOneByIdWithPassword(userId);

    const isMatch = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!isMatch) {
      this.log.warn('Password change rejected: wrong current password', {
        userId,
      });
      this.audit.auth('PASSWORD_CHANGE_FAILED', { id: userId }, {}, {
        reason: 'wrong_current_password',
      });
      throw ERROR_MESSAGES.USERS.wrongPassword;
    }
    if (changePasswordDto.currentPassword === changePasswordDto.newPassword) {
      throw ERROR_MESSAGES.USERS.conflictPassword;
    }
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    user.password = hashedPassword;
    await this.usersRepo.save(user);

    // The cached copy holds the OLD hash; drop it so nothing downstream can
    // resurrect the previous credential.
    await this.userCacheService.deleteCache(userId);

    this.log.info('Password changed', { userId });
    this.audit.auth('PASSWORD_CHANGE', { id: userId, email: user.email });
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await this.usersRepo.update({ id: userId }, { avatar: avatarUrl });

    await this.userCacheService.deleteCache(userId);

    this.log.info('Avatar updated', { userId });
  }
}

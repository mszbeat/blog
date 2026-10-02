import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ResponseDetail } from '../common/interfaces/response';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RESPONSE_MESSAGES } from '../common/constants/messages';
import { User } from './entities/user.entity';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user.role';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { SocialService } from '../social/social.service';
import { PublicProfile } from './dto/public-profile.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly socialService: SocialService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @Request() req,
  ): Promise<ResponseDetail> {
    const user = await this.usersService.create(createUserDto, req.user.id);
    return RESPONSE_MESSAGES.USERS.create(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  async findAll(): Promise<User[]> {
    const users = await this.usersService.findAll();
    return users;
  }

  /**
   * PUBLIC profile — the endpoint the frontend's author pages need.
   *
   * `GET /users/:id` below sits behind JwtAuthGuard, which made author pages
   * impossible to render for an anonymous visitor (the frontend had to
   * reconstruct an author out of their posts). This route returns everything a
   * profile page needs in ONE call, and uses OptionalJwtAuthGuard so a
   * signed-in viewer also gets `isFollowing` / `isSelf` without the route
   * rejecting anonymous traffic.
   */
  /**
   * People search (`?q=`). Declared BEFORE `:id` so "search" is not swallowed by
   * the uuid param route. Auth-gated: it exists to find someone to follow.
   * Returns a RAW array, matching `GET /users`.
   */
  @UseGuards(JwtAuthGuard)
  @Get('search')
  async search(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Promise<User[]> {
    return this.usersService.search(q ?? '', limit ? parseInt(limit, 10) : 20);
  }

  /* OptionalJwtAuthGuard is REQUIRED here, not decorative: without it the JWT
   * strategy never runs, `req.user` stays undefined and `isFollowing` is always
   * false. The UI then refetched an anonymous answer after every follow and the
   * button flipped straight back to "Follow". Anonymous readers still get 200 —
   * the guard never rejects, it only attaches the viewer when a token exists. */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/public')
  async publicProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req,
  ): Promise<ResponseDetail> {
    const viewerId: string | undefined = req.user?.id;
    const profile: PublicProfile = await this.usersService.getPublicProfile(
      id,
      viewerId ?? null,
      this.socialService,
    );
    return RESPONSE_MESSAGES.USERS.publicProfile(profile);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ResponseDetail> {
    const user = await this.usersService.findOneById(id);
    return RESPONSE_MESSAGES.USERS.findOne(user);
  }

  /**
   * Self-service profile update. Ownership is enforced in the service, so a
   * caller can only ever reach their own record — and UpdateUserDto declares no
   * `role` or `email`, so privilege escalation through this route is not
   * expressible. Admins editing OTHER users go through `:id/admin` below.
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ): Promise<ResponseDetail> {
    const updatedUser = await this.usersService.update(id, updateUserDto, {
      id: req.user.id,
      role: req.user.role,
    });
    return RESPONSE_MESSAGES.USERS.updateUser(updatedUser);
  }

  /**
   * ADMIN-ONLY user management: edit any field of any user, including `email`
   * and `role` (promote user → admin, demote admin → user).
   *
   * Split onto its own path rather than folded into `PATCH :id` so the two
   * privilege levels never share a DTO — a bug in the ownership check on one
   * route cannot silently widen what the other accepts.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/admin')
  async adminUpdate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminUpdateUserDto,
    @Request() req,
  ): Promise<ResponseDetail> {
    const updated = await this.usersService.adminUpdate(id, dto, {
      id: req.user.id,
      role: req.user.role,
    });
    return RESPONSE_MESSAGES.USERS.updateUser(updated);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req,
  ): Promise<ResponseDetail> {
    await this.usersService.remove(id, {
      id: req.user.id,
      role: req.user.role,
    });
    return RESPONSE_MESSAGES.USERS.deleteUser;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<ResponseDetail> {
    await this.usersService.changePassword(req.user.id, changePasswordDto);
    return RESPONSE_MESSAGES.USERS.changePassword;
  }
}

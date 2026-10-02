import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole } from '../../common/enums/user.role';

/**
 * ADMIN-ONLY user update — the only place `role` and `email` may be written.
 *
 * Kept separate from UpdateUserDto so the privilege boundary is expressed in
 * the type system rather than in a runtime `if (isAdmin)` scattered across the
 * service: the self-service route physically cannot receive a role change,
 * because ValidationPipe strips (and with forbidNonWhitelisted, rejects) any
 * field not declared here.
 */
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatar?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be either admin, user, or guest' })
  role?: UserRole;
}

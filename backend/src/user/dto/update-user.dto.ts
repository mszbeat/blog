import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * SELF-SERVICE profile update.
 *
 * Deliberately NOT derived from CreateUserDto any more. The previous
 * `PartialType(OmitType(CreateUserDto, ['email','confirmPassword','password']))`
 * left `role` in the whitelist, which meant any authenticated user could
 * PATCH their own record with `{ "role": "admin" }` and escalate themselves —
 * `PATCH /users/:id` had no ownership check either, so they could do it to
 * anyone. Privileged fields now live exclusively in AdminUpdateUserDto behind
 * the admin-only route.
 *
 * `avatar` is included because the profile page's "remove avatar" action sends
 * `{ avatar: '' }`; without it the global `forbidNonWhitelisted` pipe rejects
 * the request with a 400.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  /** Cloudinary URL, or an empty string to clear the avatar. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatar?: string;
}

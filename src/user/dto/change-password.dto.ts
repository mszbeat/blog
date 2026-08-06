import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Match } from '../../common/validators/match.validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;

  @IsNotEmpty()
  @IsString()
  @Match('newPassword', { message: 'Confirm new password must match new password' })
  confirmNewPassword!: string;
}

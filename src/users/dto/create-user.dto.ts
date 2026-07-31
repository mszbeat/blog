import { IsEmail, IsNotEmpty, IsString, MinLength ,IsOptional, IsEnum} from 'class-validator';
import { UserRole } from '../../common/enums/user.role';
export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsEnum(UserRole, { message: 'Role must be either admin, user, or guest' })
  @IsString()
  @IsOptional()
  role?: UserRole;

  @IsOptional()
  @IsString()
  bio?: string;
}

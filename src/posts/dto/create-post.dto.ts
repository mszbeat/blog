import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, IsEnum, IsArray, IsUUID } from 'class-validator';
import { Category } from '../../categoriy/entities/category.entity';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  excerpt?: string;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  categories?: string[]; 
}
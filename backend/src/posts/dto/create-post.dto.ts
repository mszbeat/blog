import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsArray,
  IsUUID,
} from 'class-validator';

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

  /** Gallery images (upload order). Capped client- and server-side. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  images?: string[];

  @IsBoolean()
  @IsOptional()
  published?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  categories?: string[];
}

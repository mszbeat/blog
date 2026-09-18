import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { UUID } from 'crypto';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content!: string;

  @IsUUID('all',{message:'شناسه کامنت والد باید یک UUID معتبر باشد.'})
  @IsOptional()
  parentId?: UUID;
}

import { IsOptional, IsInt, Min, IsBoolean, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryPostsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') value = value === 'false' ? false : true;
    return value;
  })
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}

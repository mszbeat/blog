import { IsBoolean, IsOptional } from 'class-validator';

export class SetLikeDto {
  @IsOptional()
  @IsBoolean()
  liked?: boolean;
}

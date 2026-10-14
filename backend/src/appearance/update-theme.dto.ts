import { IsInt, IsObject, Min } from 'class-validator';
export class UpdateThemeDto {
  @IsInt() @Min(1) version!: number;
  @IsObject() light!: Record<string, string>;
  @IsObject() dark!: Record<string, string>;
}

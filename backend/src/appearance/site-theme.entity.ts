import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
@Entity('site_theme')
export class SiteTheme {
  @PrimaryColumn({ type: 'varchar', length: 32 }) id!: string;
  @Column({ type: 'jsonb' }) light!: Record<string, string>;
  @Column({ type: 'jsonb' }) dark!: Record<string, string>;
  @Column({ type: 'integer', default: 1 }) version!: number;
  @UpdateDateColumn() updatedAt!: Date;
}

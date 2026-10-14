import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteTheme } from './site-theme.entity';
import defaults from './theme-defaults.json';
import { UpdateThemeDto } from './update-theme.dto';
import { UserRole } from '../common/enums/user.role';
import { AuditService } from '../logger/audit.service';

@Injectable()
export class AppearanceService implements OnModuleInit {
  constructor(
    @InjectRepository(SiteTheme) private readonly repo: Repository<SiteTheme>,
    private readonly audit: AuditService,
  ) {}
  async onModuleInit() {
    // Conflict-safe seeding; a restart never overwrites an administrator's work.
    for (const { id, light, dark } of defaults) {
      await this.repo
        .createQueryBuilder()
        .insert()
        .values({ id, light, dark, version: 1 })
        .orIgnore()
        .execute();
    }
  }
  async list() {
    const rows = await this.repo.find();
    return defaults.map((preset) => ({
      ...preset,
      ...rows.find((row) => row.id === preset.id),
    }));
  }
  async update(
    id: string,
    dto: UpdateThemeDto,
    actor: { id: string; role?: UserRole },
  ) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException();
    const preset = defaults.find((t) => t.id === id);
    if (!preset) throw new NotFoundException();
    const keys = Object.keys(preset.light);
    for (const mode of ['light', 'dark'] as const) {
      const colors = dto[mode];
      if (
        !colors ||
        Array.isArray(colors) ||
        Object.keys(colors).length !== keys.length ||
        keys.some(
          (k) =>
            !Object.hasOwn(colors, k) ||
            typeof colors[k] !== 'string' ||
            !/^#[\da-f]{6}([\da-f]{2})?$/i.test(colors[k]),
        )
      ) {
        throw new BadRequestException({
          message: {
            en: 'Use the complete known color palette with HEX colors only.',
            fa: 'فقط رنگ‌های HEX و متغیرهای تعریف‌شدهٔ پالت مجازند؛ همهٔ رنگ‌ها را ارسال کنید.',
          },
        });
      }
    }
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ light: dto.light, dark: dto.dark, version: () => '"version" + 1' })
      .where('id = :id AND version = :version', { id, version: dto.version })
      .returning('*')
      .execute();
    if (!result.affected)
      throw new ConflictException({
        message: {
          en: 'This theme was changed elsewhere. Reload before saving.',
          fa: 'این تم جای دیگری تغییر کرده است. قبل از ذخیره، نسخهٔ جدید را بارگذاری کنید.',
        },
      });
    this.audit.record({
      action: 'UPDATE_THEME',
      entity: 'site_theme',
      entityId: id,
      actorId: actor.id,
      actorType: 'admin',
      metadata: { version: dto.version + 1 },
    });
    // Return THIS transaction's result, not a later concurrent writer's values.
    return { ...preset, ...result.raw[0] };
  }
}

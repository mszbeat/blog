import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteTheme } from './site-theme.entity';
import { AppearanceController } from './appearance.controller';
import { AppearanceService } from './appearance.service';
@Module({
  imports: [TypeOrmModule.forFeature([SiteTheme])],
  controllers: [AppearanceController],
  providers: [AppearanceService],
})
export class AppearanceModule {}

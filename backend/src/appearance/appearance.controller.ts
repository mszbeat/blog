import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppearanceService } from './appearance.service';
import { UpdateThemeDto } from './update-theme.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user.role';
@Controller('appearance/themes')
export class AppearanceController {
  constructor(private readonly appearance: AppearanceService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list() {
    return this.appearance.list();
  }
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateThemeDto,
    @Req() req: any,
  ) {
    return this.appearance.update(id, dto, req.user);
  }
}

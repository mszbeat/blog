// category/category.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CategoryService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user.role';
import { ResponseDetail } from '../common/interfaces/response';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoriesService: CategoryService) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<ResponseDetail> {
    const category = await this.categoriesService.create(createCategoryDto);
    return {
      message: { fa: 'دسته‌بندی با موفقیت ایجاد شد', en: 'Category created successfully' },
      data: category,
    };
  }

  @Get()
  async findAll(): Promise<ResponseDetail> {
    const categories = await this.categoriesService.findAll();
    return {
      message: { fa: 'دسته‌بندی‌ها با موفقیت بازیابی شدند', en: 'Categories retrieved successfully' },
      data: { categories },
    };
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string): Promise<ResponseDetail> {
    const category = await this.categoriesService.findBySlug(slug);
    return {
      message: { fa: 'دسته‌بندی با موفقیت بازیابی شد', en: 'Category retrieved successfully' },
      data: category,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<ResponseDetail> {
    const category = await this.categoriesService.update(id, updateCategoryDto);
    return {
      message: { fa: 'دسته‌بندی با موفقیت به‌روزرسانی شد', en: 'Category updated successfully' },
      data: category,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ResponseDetail> {
    await this.categoriesService.remove(id);
    return {
      message: { fa: 'دسته‌بندی با موفقیت حذف شد', en: 'Category deleted successfully' }
    };
  }
}
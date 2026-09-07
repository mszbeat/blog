// category/category.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../common/utilities/slug.util';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepo: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoriesRepo.exist({
      where: { name: createCategoryDto.name },
    });
    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    const slug = await this.generateUniqueSlug(createCategoryDto.name);

    const category = this.categoriesRepo.create({
      ...createCategoryDto,
      slug,
    });

    return this.categoriesRepo.save(category);
  }

  findAll(): Promise<Category[]> {
    return this.categoriesRepo.find();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepo.findOneBy({ id });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoriesRepo.findOne({
      where: { slug },
      relations: ['posts'],
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  // برای استفاده داخلی توسط PostService (وقتی می‌خواد categoryهای یه پست رو ست کنه)
  async findByIds(ids: string[]): Promise<Category[]> {
    const categories = await this.categoriesRepo.findBy({ id: In(ids) });

    if (categories.length !== ids.length) {
      throw new NotFoundException('One or more categories not found');
    }

    return categories;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      category.slug = await this.generateUniqueSlug(updateCategoryDto.name);
    }

    Object.assign(category, updateCategoryDto);
    return this.categoriesRepo.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoriesRepo.remove(category);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.categoriesRepo.exist({ where: { slug } })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }
}
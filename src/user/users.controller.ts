import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseDetail } from '../common/interfaces/response';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<ResponseDetail> {
    const user = await this.usersService.create(createUserDto);
    return {
      message: {
        en: 'User created successfully',
        fa: 'کاربر با موفقیت ایجاد شد'
      },
      additionalInfo: user
    };
  }

  @Get()
  async findAll(): Promise<ResponseDetail> {
    const users = await this.usersService.findAll();
    return {
      message: {
        fa: 'کاربران با موفقیت بازیابی شدند',
        en: 'Users retrieved successfully'
      },
      additionalInfo: {
        users
      }
    }
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<ResponseDetail> {
    const user = await this.usersService.findOne(id);

    return {
      message: {
        fa: 'کاربر با موفقیت بازیابی شد',
        en: 'User retrieved successfully'
      },
      additionalInfo: user
    };
  }

  @Patch(':id')
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() updateUserDto: UpdateUserDto): Promise<ResponseDetail> {
    const updatedUser = await this.usersService.update(id, updateUserDto);
    return {
      message: {
        fa: 'کاربر با موفقیت به‌روزرسانی شد',
        en: 'User updated successfully'
      },
      additionalInfo: updatedUser
    };
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) : Promise<ResponseDetail> {
    await this.usersService.remove(id);
    return {
      message: {
        fa: 'کاربر با موفقیت حذف شد',
        en: 'User deleted successfully'
      }
    };
  }

}

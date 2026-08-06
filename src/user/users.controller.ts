import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseDetail } from '../common/interfaces/response';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RESPONSE_MESSAGES } from '../common/constants/messages';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<ResponseDetail> {
    const user = await this.usersService.create(createUserDto);
    return RESPONSE_MESSAGES.USERS.create(user);
  }

  @Get()
  async findAll(): Promise<User[]> {
    const users = await this.usersService.findAll();
    return users;
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<ResponseDetail> {
    const user = await this.usersService.findOneById(id);
    return RESPONSE_MESSAGES.USERS.findOne(user);
  }

  @Patch(':id')
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() updateUserDto: UpdateUserDto): Promise<ResponseDetail> {
    const updatedUser = await this.usersService.update(id, updateUserDto);
    return RESPONSE_MESSAGES.USERS.updateUser(updatedUser);
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<ResponseDetail> {
    await this.usersService.remove(id);
    return RESPONSE_MESSAGES.USERS.deleteUser;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto): Promise<ResponseDetail> {
    await this.usersService.changePassword(req.user.id, changePasswordDto);
    return RESPONSE_MESSAGES.USERS.changePassword;
  }
}

import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ERROR_MESSAGES } from '../common/constants/messages';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>
  ) { }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepo.exist({ where: { email: createUserDto.email } });
    if (existingUser) {
      throw ERROR_MESSAGES.USERS.emailAlreadyExists;
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = this.usersRepo.create({ ...createUserDto, password: hashedPassword });
    await this.usersRepo.save(newUser);

    return newUser;
  }

  findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  async findOneById(id: string): Promise<User> {
    const user: User | null = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    return user;
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return await this.usersRepo.findOneBy({ email });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.usersRepo.save(user);
    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    const existingUser = await this.usersRepo.exist({ where: { id } });
    if (!existingUser) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }
    await this.usersRepo.delete({ id });
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.findOneById(userId);

    const isMatch = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isMatch) {
      throw ERROR_MESSAGES.USERS.wrongPassword;
    }
    if (changePasswordDto.currentPassword === changePasswordDto.newPassword) {
      throw ERROR_MESSAGES.USERS.conflictPassword;
    }
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    user.password = hashedPassword;
    await this.usersRepo.save(user);
  }
}

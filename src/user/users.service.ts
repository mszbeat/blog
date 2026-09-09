import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ERROR_MESSAGES } from '../common/constants/messages';
import { UserCacheService } from './user-cache.service';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,

    private readonly userCacheService: UserCacheService
  ) { }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepo.exist({ where: { email: createUserDto.email } });
    if (existingUser) {
      throw ERROR_MESSAGES.USERS.emailAlreadyExists;
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const newUser = this.usersRepo.create({ ...createUserDto, password: hashedPassword });
    await this.usersRepo.save(newUser);

    await this.userCacheService.createCache(newUser);
    return newUser;
  }

  findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  async findOneById(id: string): Promise<User> {
    const cachedUser = await this.userCacheService.getById(id);
    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    await this.userCacheService.createCache(user);
    return user;
  }

  async findOneByEmail(email: string): Promise<User | null> {
    const user = await this.usersRepo.findOneBy({ email });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.usersRepo.findOneBy({ id });
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.usersRepo.save(user);
    await this.userCacheService.deleteCache(id);
    await this.userCacheService.createCache(updatedUser);
    return updatedUser;
  }

  async remove(id: string): Promise<void> {
    await this.findOneById(id);
    await this.usersRepo.delete({ id });
    await this.userCacheService.deleteCache(id);
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

  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await this.usersRepo.update({ id: userId }, { avatar: avatarUrl });

    await this.userCacheService.deleteCache(userId);
  }
}

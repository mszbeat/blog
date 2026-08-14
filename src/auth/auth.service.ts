import { Injectable } from '@nestjs/common';
import { UsersService } from '../user/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import *as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/entities/user.entity';
import { SessionService } from './session.service';
import { v4 as uuid } from 'uuid';
import { ERROR_MESSAGES } from '../common/constants/messages';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessionService: SessionService
  ) { }

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(registerDto);
    const tokens = await this.generateToken(user);
    return { user, ...tokens };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findOneByEmail(loginDto.email);
    if (!user) {
      throw ERROR_MESSAGES.AUTH.invalidCredentials;
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      throw ERROR_MESSAGES.AUTH.invalidCredentials;
    }

    const tokens = await this.generateToken(user);

    return { user, ...tokens };
  }

  async generateToken(user: User, meta: { ip?: string, userAgent?: string } = {}) {
    const sessionId = uuid();
    const payload = { id: user.id, email: user.email, sessionId };

    const accessExpiresIn = Number(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN')
    );
    const refreshExpiresIn: number = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      })
    ]);

    const expirationSession = Number(this.configService.get<string>('SESSION_EXPIRATION'));
    await this.sessionService.saveSession(
      user.id,
      sessionId,
      refreshToken,
      meta,
      expirationSession
    );

    return { accessToken, refreshToken };
  }

  async refreshToken(
    userId: string,
    sessionId: string,
    refreshToken: string,
    meta: { ip?: string, userAgent?: string }
  ) {
    const isValidSession = await this.sessionService.validateSession(userId, sessionId, refreshToken);
    if (!isValidSession) {
      throw ERROR_MESSAGES.AUTH.invalidSessionOrToken;
    }

    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }
    
    await this.sessionService.deleteSession(user.id, sessionId)
    return await this.generateToken(user, meta);
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessionService.deleteSession(userId, sessionId);
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.sessionService.deleteAllSessionsForUser(userId);
  }
}

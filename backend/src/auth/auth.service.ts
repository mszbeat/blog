import { Injectable } from '@nestjs/common';
import { UsersService } from '../user/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/entities/user.entity';
import { SessionService } from './session.service';
import { v4 as uuid } from 'uuid';
import { ERROR_MESSAGES } from '../common/constants/messages';
import { AppLoggerService } from '../logger/app-logger.service';
import { AuditService } from '../logger/audit.service';

/** Caller metadata captured by the controller for logging/audit only. */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly log = this.logger.forContext('AuthService');

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessionService: SessionService,
    private readonly logger: AppLoggerService,
    private readonly audit: AuditService,
  ) {}

  async register(registerDto: RegisterDto, meta: RequestMeta = {}) {
    const startedAt = Date.now();
    this.log.debug('Registration attempted', {
      email: registerDto.email,
      ip: meta.ip,
    });

    try {
      const user = await this.usersService.create(registerDto);
      const tokens = await this.generateToken(user, meta);

      this.log.info('User registered', {
        userId: user.id,
        email: user.email,
        role: user.role,
        durationMs: Date.now() - startedAt,
      });
      this.audit.auth(
        'REGISTER',
        { id: user.id, email: user.email, role: user.role },
        meta,
        { durationMs: Date.now() - startedAt },
      );

      return { user, ...tokens };
    } catch (err) {
      // Registration failures are almost always a duplicate email — worth a
      // warning (not an error) so a burst of them reads as abuse, not an outage.
      this.log.warn('Registration failed', {
        email: registerDto.email,
        ip: meta.ip,
        reason: (err as Error)?.message,
      });
      this.audit.auth('REGISTER_FAILED', { email: registerDto.email }, meta, {
        reason: (err as Error)?.message,
      });
      throw err;
    }
  }

  async login(loginDto: LoginDto, meta: RequestMeta = {}) {
    const startedAt = Date.now();

    const user = await this.usersService.findOneByEmail(loginDto.email);
    if (!user) {
      // Unknown email. Logged with the attempted address so credential-stuffing
      // patterns are visible; never logged with a password (the redactor would
      // strip it anyway, but we do not pass it at all).
      this.log.warn('Login failed: unknown email', {
        email: loginDto.email,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      this.audit.auth('LOGIN_FAILED', { email: loginDto.email }, meta, {
        reason: 'unknown_email',
      });
      throw ERROR_MESSAGES.AUTH.invalidCredentials;
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      // A known account with a wrong password is the higher-signal event: this
      // is what a brute-force attempt looks like.
      this.log.warn('Login failed: wrong password', {
        userId: user.id,
        email: user.email,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      this.audit.auth(
        'LOGIN_FAILED',
        { id: user.id, email: user.email, role: user.role },
        meta,
        { reason: 'wrong_password' },
      );
      throw ERROR_MESSAGES.AUTH.invalidCredentials;
    }

    const tokens = await this.generateToken(user, meta);

    this.log.info('Login successful', {
      userId: user.id,
      email: user.email,
      role: user.role,
      durationMs: Date.now() - startedAt,
    });
    this.audit.auth(
      'LOGIN',
      { id: user.id, email: user.email, role: user.role },
      meta,
      { durationMs: Date.now() - startedAt },
    );

    return { user, ...tokens };
  }

  async generateToken(user: User, meta: RequestMeta = {}) {
    const sessionId = uuid();
    const payload = { id: user.id, email: user.email, sessionId };

    const accessExpiresIn = Number(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
    );
    const refreshExpiresIn: number = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      }),
    ]);

    const expirationSession = Number(
      this.configService.get<string>('SESSION_EXPIRATION'),
    );
    await this.sessionService.saveSession(
      user.id,
      sessionId,
      refreshToken,
      meta,
      expirationSession,
    );

    this.log.debug('Session created', {
      userId: user.id,
      sessionId,
      ttlSeconds: expirationSession,
    });

    // Token values are never passed to the logger; the ambient redactor would
    // catch `accessToken`/`refreshToken` keys, but omitting them entirely means
    // a future refactor cannot accidentally widen what reaches disk.
    return { accessToken, refreshToken };
  }

  async refreshToken(
    userId: string,
    sessionId: string,
    refreshToken: string,
    meta: RequestMeta,
  ) {
    const isValidSession = await this.sessionService.validateSession(
      userId,
      sessionId,
      refreshToken,
    );
    if (!isValidSession) {
      // A rejected refresh means a stolen/replayed or already-rotated token was
      // presented — always worth an explicit security-level warning.
      this.log.warn('Token refresh rejected: invalid session', {
        userId,
        sessionId,
        ip: meta.ip,
      });
      this.audit.auth('REFRESH_REJECTED', { id: userId }, meta, { sessionId });
      throw ERROR_MESSAGES.AUTH.invalidSessionOrToken;
    }

    const user = await this.usersService.findOneById(userId);
    if (!user) {
      this.log.warn('Token refresh rejected: user no longer exists', {
        userId,
        sessionId,
      });
      throw ERROR_MESSAGES.USERS.userNotFound;
    }

    // Rotation: the old session is destroyed before the new one is issued, so a
    // leaked refresh token stops working the moment the real user refreshes.
    await this.sessionService.deleteSession(user.id, sessionId);
    const tokens = await this.generateToken(user, meta);

    this.log.info('Token refreshed', {
      userId: user.id,
      previousSessionId: sessionId,
      ip: meta.ip,
    });
    this.audit.auth(
      'REFRESH',
      { id: user.id, email: user.email, role: user.role },
      meta,
      { previousSessionId: sessionId },
    );

    return tokens;
  }

  async logout(
    userId: string,
    sessionId: string,
    meta: RequestMeta = {},
  ): Promise<void> {
    await this.sessionService.deleteSession(userId, sessionId);
    this.log.info('Logout', { userId, sessionId, ip: meta.ip });
    this.audit.auth('LOGOUT', { id: userId }, meta, { sessionId });
  }

  async logoutAllDevices(
    userId: string,
    meta: RequestMeta = {},
  ): Promise<void> {
    await this.sessionService.deleteAllSessionsForUser(userId);
    // Revoking every session is a strong, user-visible security action (usually
    // taken after suspecting a compromise) — always audited.
    this.log.warn('All sessions revoked', { userId, ip: meta.ip });
    this.audit.auth('LOGOUT_ALL_DEVICES', { id: userId }, meta);
  }
}

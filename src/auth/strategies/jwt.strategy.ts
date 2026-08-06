import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../user/users.service';
import { ERROR_MESSAGES } from '../../common/constants/messages';
import { SessionService } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private readonly sessionService: SessionService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: { sub: string; email: string, sessionId: string }) {
    const sessionExists = await this.sessionService.sessionExists(payload.sub, payload.sessionId);
    if (!sessionExists) {
      throw ERROR_MESSAGES.AUTH.invalidSessionOrToken;
    }
    const user = await this.usersService.findOneById(payload.sub);
    if (!user) {
      throw ERROR_MESSAGES.USERS.userNotFound;
    }
    return user;
  }
}
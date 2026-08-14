import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ERROR_MESSAGES } from '../../common/constants/messages';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET')!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { id: string; email: string, sessionId: string }) {
    const refreshToken = req.headers.authorization?.split('Bearer ')[1];
    if (!refreshToken) {
      throw ERROR_MESSAGES.AUTH.invalidSessionOrToken;
    }
    return { ...payload, refreshToken };
  }
}
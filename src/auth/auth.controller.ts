import { Controller, Get, Post, Body, Request, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { ResponseDetail } from '../common/interfaces/response';
import { RESPONSE_MESSAGES } from '../common/constants/messages';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<ResponseDetail> {
    const result = await this.authService.register(registerDto);
    return RESPONSE_MESSAGES.AUTH.register(result);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto): Promise<ResponseDetail> {
    const data = await this.authService.login(loginDto);
    return RESPONSE_MESSAGES.AUTH.login(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req): Promise<ResponseDetail> {
    return RESPONSE_MESSAGES.AUTH.getMe(req.user);
  }

  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  async refreshToken(@Request() req): Promise<ResponseDetail> {
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };
    const data = await this.authService.refreshToken(
      req.user.id,
      req.user.sessionId,
      req.user.refreshToken,
      meta
    );

    return RESPONSE_MESSAGES.AUTH.refreshToken(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req): Promise<ResponseDetail> {
    await this.authService.logout(req.user.id, req.user.sessionId);
    return RESPONSE_MESSAGES.AUTH.logout;
  }
}

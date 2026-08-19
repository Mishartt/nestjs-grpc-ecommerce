import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Get('captcha')
  getCaptcha() {
    return this.captchaService.generate();
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: { user: { id: string } }) {
    return this.authService.getMe(req.user.id);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    this.captchaService.verify(dto.captchaId, dto.captcha);
    return this.authService.register({
      email: dto.email,
      password: dto.password,
    });
  }

  @Post('login')
  login(@Body() dto: AuthCredentialsDto) {
    return this.authService.login(dto);
  }
}

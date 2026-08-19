import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  AUTH_PACKAGE_NAME,
  AUTH_SERVICE,
  PROTO_PATH,
} from '@app/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CaptchaService } from './captcha.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ClientsModule.register([
      {
        name: AUTH_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: AUTH_PACKAGE_NAME,
          protoPath: PROTO_PATH.auth,
          url: process.env.AUTH_SERVICE_URL || 'localhost:5000',
        },
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, CaptchaService, JwtStrategy],
})
export class AuthModule {}
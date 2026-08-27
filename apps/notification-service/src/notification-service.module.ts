import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  AUTH_PACKAGE_NAME,
  AUTH_SERVICE,
  PROTO_PATH,
} from '@app/common';
import { NotificationServiceController } from './notification-service.controller';
import { MailService } from './mail.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  controllers: [NotificationServiceController],
  providers: [MailService],
})
export class NotificationServiceModule {}

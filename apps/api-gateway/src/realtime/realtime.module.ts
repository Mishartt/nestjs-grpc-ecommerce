import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  ORDER_PACKAGE_NAME,
  ORDER_SERVICE,
  PAYMENT_PACKAGE_NAME,
  PAYMENT_SERVICE,
  PROTO_PATH,
} from '@app/common';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'secret',
    }),
    ClientsModule.register([
      {
        name: ORDER_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: ORDER_PACKAGE_NAME,
          protoPath: PROTO_PATH.order,
          url: process.env.ORDER_SERVICE_URL || 'localhost:5002',
        },
      },
      {
        name: PAYMENT_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: PAYMENT_PACKAGE_NAME,
          protoPath: PROTO_PATH.payment,
          url: process.env.PAYMENT_SERVICE_URL || 'localhost:5003',
        },
      },
    ]),
  ],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}

import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ORDER_PACKAGE_NAME, ORDER_SERVICE, PAYMENT_PACKAGE_NAME, PAYMENT_SERVICE, PROTO_PATH } from '@app/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: PAYMENT_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: PAYMENT_PACKAGE_NAME,
          protoPath: PROTO_PATH.payment,
          url: process.env.PAYMENT_SERVICE_URL || 'localhost:5003',
        },
      },
      {
        name: ORDER_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: ORDER_PACKAGE_NAME,
          protoPath: PROTO_PATH.order,
          url: process.env.ORDER_SERVICE_URL || 'localhost:5002',
        },
      },
    ]),
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}

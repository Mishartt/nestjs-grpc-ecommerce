import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ORDER_PACKAGE_NAME, ORDER_SERVICE, PROTO_PATH } from '@app/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';


@Module({
  imports: [
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
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, RolesGuard],
})
export class OrdersModule {}

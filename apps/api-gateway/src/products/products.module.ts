import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  PRODUCT_PACKAGE_NAME,
  PRODUCT_SERVICE,
  PROTO_PATH,
} from '@app/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';


@Module({
  imports: [
    ClientsModule.register([
      {
        name: PRODUCT_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: PRODUCT_PACKAGE_NAME,
          protoPath: PROTO_PATH.product,
          url: process.env.PRODUCT_SERVICE_URL || 'localhost:5001',
        },
      },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
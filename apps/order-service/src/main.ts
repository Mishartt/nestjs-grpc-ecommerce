import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { GRPC_URL, ORDER_PACKAGE_NAME, PROTO_PATH } from '@app/common';
import { OrderServiceModule } from './order-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    OrderServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        url: GRPC_URL.order,
        package: ORDER_PACKAGE_NAME,
        protoPath: PROTO_PATH.order,
      },
    },
  );
  await app.listen().then(() => {
    console.log(`Order service is running on ${GRPC_URL.order}`);
  });
}
bootstrap();

import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { GRPC_URL, PRODUCT_PACKAGE_NAME, PROTO_PATH } from '@app/common';
import { ProductServiceModule } from './product-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ProductServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        url: GRPC_URL.product,
        package: PRODUCT_PACKAGE_NAME,
        protoPath: PROTO_PATH.product,
      },
    },
  );
  await app.listen().then(() => {
    console.log(`Product service is running on ${GRPC_URL.product}`);
  });
}
bootstrap();

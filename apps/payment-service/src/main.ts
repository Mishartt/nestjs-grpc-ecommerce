import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { GRPC_URL, PAYMENT_PACKAGE_NAME, PROTO_PATH } from '@app/common';
import { PaymentServiceModule } from './payment-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PaymentServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        url: GRPC_URL.payment,
        package: PAYMENT_PACKAGE_NAME,
        protoPath: PROTO_PATH.payment,
      },
    },
  );
  await app.listen().then(() => {
    console.log(`Payment service is running on ${GRPC_URL.payment}`);
  });
}
bootstrap();

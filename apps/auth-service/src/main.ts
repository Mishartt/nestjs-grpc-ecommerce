import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AUTH_PACKAGE_NAME, GRPC_URL, PROTO_PATH } from '@app/common';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        url: GRPC_URL.auth,
        package: AUTH_PACKAGE_NAME,
        protoPath: PROTO_PATH.auth,
      },
    },
  );
  await app.listen().then(() => {
    console.log(`Auth service is running on ${GRPC_URL.auth}`);
  });
}
bootstrap();

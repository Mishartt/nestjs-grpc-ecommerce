import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { GrpcToHttpExceptionFilter } from './common/filters/grpc-to-http.exception-filter';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GrpcToHttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

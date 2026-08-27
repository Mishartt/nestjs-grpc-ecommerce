import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  ORDER_EVENTS_QUEUE,
  rabbitmqUrl,
} from '@app/common';
import { NotificationServiceModule } from './notification-service.module';

config();

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl()],
        queue: ORDER_EVENTS_QUEUE,
        queueOptions: { durable: true },
      },
    },
  );
  await app.listen();
  console.log(`Notification service is listening on ${ORDER_EVENTS_QUEUE}`);
}
bootstrap();

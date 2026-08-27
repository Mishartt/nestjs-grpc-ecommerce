import { Controller, Inject, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import type { ClientGrpc } from '@nestjs/microservices';
import {
  AUTH_SERVICE,
  AUTH_SERVICE_NAME,
  AuthServiceClient,
  ORDER_EVENT_PATTERN,
  type OrderStatusEvent,
} from '@app/common';
import { MailService } from './mail.service';

@Controller()
export class NotificationServiceController implements OnModuleInit {
  private readonly logger = new Logger(NotificationServiceController.name);
  private authClient!: AuthServiceClient;

  constructor(
    @Inject(AUTH_SERVICE) private readonly authGrpc: ClientGrpc,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    this.authClient =
      this.authGrpc.getService<AuthServiceClient>(AUTH_SERVICE_NAME);
  }

  @EventPattern(ORDER_EVENT_PATTERN)
  async onOrderUpdated(event: OrderStatusEvent) {
    if (!event?.orderId || !event.userId) {
      this.logger.warn('Ignored malformed order event');
      return;
    }

    const to = await this.resolveEmail(event.userId);
    if (!to) {
      this.logger.warn(
        `No email for user ${event.userId} (order ${event.orderId})`,
      );
      return;
    }

    try {
      await this.mail.sendOrderEmail(to, event);
    } catch (err) {
      this.logger.error(
        `Failed to send mail for order ${event.orderId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async resolveEmail(userId: string) {
    try {
      const { users } = await firstValueFrom(
        this.authClient.getUsers({ ids: [userId] }),
      );
      return users?.find((user) => user.id === userId)?.email ?? '';
    } catch (err) {
      this.logger.error(
        `Failed to resolve email for ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return '';
    }
  }
}

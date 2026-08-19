import {
  ORDER_SERVICE,
  ORDER_SERVICE_NAME,
  OrderServiceClient,
  PAYMENT_SERVICE,
  PAYMENT_SERVICE_NAME,
  PaymentServiceClient,
} from '@app/common';
import {
  Inject,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { defer, retry, Subscription, timer } from 'rxjs';
import { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

type SocketUser = {
  id: string;
  role: string;
};

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly subscriptions = new Subscription();
  private orderClient!: OrderServiceClient;
  private paymentClient!: PaymentServiceClient;

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(ORDER_SERVICE) private readonly orderGrpc: ClientGrpc,
    @Inject(PAYMENT_SERVICE) private readonly paymentGrpc: ClientGrpc,
    private readonly jwt: JwtService,
  ) {}

  onModuleInit() {
    this.orderClient =
      this.orderGrpc.getService<OrderServiceClient>(ORDER_SERVICE_NAME);
    this.paymentClient =
      this.paymentGrpc.getService<PaymentServiceClient>(PAYMENT_SERVICE_NAME);

    this.subscriptions.add(
      defer(() => this.orderClient.watchOrders({}))
        .pipe(retry({ delay: () => timer(3000) }))
        .subscribe({
          next: (order) => {
            this.server.to(`user:${order.userId}`).emit('order.updated', order);
            this.server.to('admin').emit('order.updated', order);
          },
          error: (error: unknown) =>
            this.logger.error('Order stream failed', error),
        }),
    );

    this.subscriptions.add(
      defer(() => this.paymentClient.watchPayments({}))
        .pipe(retry({ delay: () => timer(3000) }))
        .subscribe({
          next: (payment) => {
            this.server.to('admin').emit('payment.created', payment);
          },
          error: (error: unknown) =>
            this.logger.error('Payment stream failed', error),
        }),
    );
  }

  onModuleDestroy() {
    this.subscriptions.unsubscribe();
  }

  handleConnection(client: Socket) {
    const user = this.readUser(client);
    if (!user) {
      client.disconnect(true);
      return;
    }

    client.data.user = user;
    void client.join(`user:${user.id}`);
    if (user.role === 'ADMIN') {
      void client.join('admin');
    }
  }

  private readUser(client: Socket): SocketUser | null {
    const token = this.readToken(client);
    if (!token) {
      return null;
    }

    try {
      const payload = this.jwt.verify(token) as JwtPayload;
      if (!payload.sub || !payload.role) {
        return null;
      }
      return { id: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }

  private readToken(client: Socket): string | null {
    const fromAuth = client.handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) {
      return fromAuth;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return null;
  }
}

import {
  Payment,
  ORDER_SERVICE,
  ORDER_SERVICE_NAME,
  OrderServiceClient,
  PAYMENT_SERVICE,
  PAYMENT_SERVICE_NAME,
  PaymentServiceClient,
} from '@app/common';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Observable } from 'rxjs';

@Injectable()
export class PaymentsService implements OnModuleInit {
  private orderClient!: OrderServiceClient;
  private paymentClient!: PaymentServiceClient;

  constructor(
    @Inject(ORDER_SERVICE) private orderGrpc: ClientGrpc,
    @Inject(PAYMENT_SERVICE) private paymentGrpc: ClientGrpc,
  ) {}

  onModuleInit() {
    this.orderClient =
      this.orderGrpc.getService<OrderServiceClient>(ORDER_SERVICE_NAME);
    this.paymentClient =
      this.paymentGrpc.getService<PaymentServiceClient>(PAYMENT_SERVICE_NAME);
  }

  async pay(orderId: string, userId: string) {
    const order = await firstValueFrom(
      this.orderClient.getOrder({ id: orderId }),
    );

    if (order.userId !== userId) {
      throw new ForbiddenException('You are not allowed to pay for this order');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('Order is not pending');
    }

    const payment = await firstValueFrom(
      this.paymentClient.processPayment({
        orderId,
        userId,
        amount: order.totalAmount,
      }),
    );

    const updatedOrder =
      payment.status === 'SUCCESS'
        ? await firstValueFrom(
            this.orderClient.updateOrderStatus({
              id: orderId,
              status: 'PAID',
            }),
          )
        : await firstValueFrom(this.orderClient.failOrder({ id: orderId }));

    return {
      payment,
      order: updatedOrder,
    };
  }

  async listAllPayments() {
    const response = await firstValueFrom(this.paymentClient.listPayments({}));
    return response.payments;
  }

  watchPayments(): Observable<Payment> {
    return this.paymentClient.watchPayments({});
  }
}

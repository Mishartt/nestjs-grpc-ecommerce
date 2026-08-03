import {
  GetPaymentRequest,
  Payment,
  ProcessPaymentRequest,
} from '@app/common';
import {
  ListPaymentsRequest,
  ListPaymentsResponse,
  WatchPaymentsRequest,
} from '@app/common/generated/payment';
import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Observable, Subject } from 'rxjs';
import { Repository } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';

@Injectable()
export class PaymentServiceService {
  private readonly paymentUpdates = new Subject<Payment>();

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentsRepo: Repository<PaymentEntity>,
  ) {}

  private toProto(payment: PaymentEntity): Payment {
    return {
      id: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      amount: payment.amount,
      status: payment.status,
    };
  }

  async processPayment(data: ProcessPaymentRequest): Promise<Payment> {
    if (!data.orderId || !data.userId || data.amount <= 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'orderId, userId and positive amount are required',
      });
    }

    const saved = await this.paymentsRepo.save(
      this.paymentsRepo.create({
        orderId: data.orderId,
        userId: data.userId,
        amount: data.amount,
        status: Math.random() < 0.3 ? 'FAILED' : 'SUCCESS',
      }),
    );

    const proto = this.toProto(saved);
    this.paymentUpdates.next(proto);
    return proto;
  }

  async getPayment(request: GetPaymentRequest): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({
      where: { id: request.id },
    });

    if (!payment) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Payment ${request.id} not found`,
      });
    }

    return this.toProto(payment);
  }

  async listPayments(_: ListPaymentsRequest): Promise<ListPaymentsResponse> {
    const payments = await this.paymentsRepo.find();
    return {
      payments: payments.map((payment) => this.toProto(payment)),
    };
  }

  watchPayments(_: WatchPaymentsRequest): Observable<Payment> {
    return this.paymentUpdates.asObservable();
  }
}

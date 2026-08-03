import { Controller } from '@nestjs/common';
import {
  GetPaymentRequest,
  ListPaymentsRequest,
  ProcessPaymentRequest,
  WatchPaymentsRequest,
  PaymentServiceControllerMethods,
  PaymentServiceController as IPaymentServiceController,
} from '@app/common';
import { PaymentServiceService } from './payment-service.service';

@Controller()
@PaymentServiceControllerMethods()
export class PaymentServiceController implements IPaymentServiceController {
  constructor(private readonly paymentService: PaymentServiceService) {}

  processPayment(request: ProcessPaymentRequest) {
    return this.paymentService.processPayment(request);
  }

  getPayment(request: GetPaymentRequest) {
    return this.paymentService.getPayment(request);
  }

  listPayments(request: ListPaymentsRequest) {
    return this.paymentService.listPayments(request);
  }

  watchPayments(request: WatchPaymentsRequest) {
    return this.paymentService.watchPayments(request);
  }
}
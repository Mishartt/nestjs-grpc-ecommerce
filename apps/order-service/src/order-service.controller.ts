import { Controller } from '@nestjs/common';
import {
  CreateOrderRequest,
  GetAllOrdersRequest,
  GetOrderRequest,
  ListOrdersRequest,
  OrderServiceControllerMethods,
  OrderServiceController as IOrderServiceController,
  UpdateOrderStatusRequest,
  WatchOrderStatusRequest,
  WatchOrdersRequest,
} from '@app/common';
import { OrderServiceService } from './order-service.service';

@Controller()
@OrderServiceControllerMethods()
export class OrderServiceController implements IOrderServiceController {
  constructor(private readonly orderService: OrderServiceService) {}

  createOrder(request: CreateOrderRequest) {
    return this.orderService.createOrder(request);
  }

  getOrder(request: GetOrderRequest) {
    return this.orderService.getOrder(request.id);
  }

  listOrders(request: ListOrdersRequest) {
    return this.orderService.listOrders(request.userId);
  }

  listAllOrders(_request: GetAllOrdersRequest) {
    return this.orderService.listAllOrders();
  }

  updateOrderStatus(request: UpdateOrderStatusRequest) {
    return this.orderService.updateOrderStatus(request);
  }

  failOrder(request: GetOrderRequest) {
    return this.orderService.failOrder(request.id);
  }

  watchOrderStatus(request: WatchOrderStatusRequest) {
    return this.orderService.watchOrderStatus(request.id);
  }

  watchOrders(_request: WatchOrdersRequest) {
    return this.orderService.watchOrders();
  }
}

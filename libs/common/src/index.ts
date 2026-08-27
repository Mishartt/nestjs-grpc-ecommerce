export * from './constants';
export {
  ORDER_EVENTS_CLIENT,
  ORDER_EVENTS_QUEUE,
  ORDER_EVENT_PATTERN,
  orderEventType,
  rabbitmqUrl,
} from './events/order-events';
export type {
  OrderEventItem,
  OrderEventType,
  OrderStatusEvent,
} from './events/order-events';

export {
  PRODUCT_PACKAGE_NAME,
  PRODUCT_SERVICE_NAME,
  ProductServiceControllerMethods,
} from './generated/product';

export type {
  Product,
  CreateProductRequest,
  GetProductRequest,
  ListProductsRequest,
  ListProductsResponse,
  DecreaseStockRequest,
  IncreaseStockRequest,
  Comment,
  ListCommentsRequest,
  ListCommentsResponse,
  CreateCommentRequest,
  ProductServiceClient,
  ProductServiceController,
} from './generated/product';

export {
  AUTH_PACKAGE_NAME,
  AUTH_SERVICE_NAME,
  AuthServiceControllerMethods,
} from './generated/auth';

export type {
  User,
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  GetMeRequest,
  GetUsersRequest,
  GetUsersResponse,
  AuthServiceClient,
  AuthServiceController,
} from './generated/auth';


export {
  ORDER_PACKAGE_NAME,
  ORDER_SERVICE_NAME,
  OrderServiceControllerMethods,
} from './generated/order';

export type {
  Order,
  CreateOrderRequest,
  GetOrderRequest,
  ListOrdersRequest,
  ListOrdersResponse,
  OrderServiceClient,
  OrderServiceController,
  GetAllOrdersRequest,
  UpdateOrderStatusRequest,
  WatchOrderStatusRequest,
  WatchOrdersRequest,
} from './generated/order';

export {
  PAYMENT_PACKAGE_NAME,
  PAYMENT_SERVICE_NAME,
  PaymentServiceControllerMethods,
} from './generated/payment';

export type {
  Payment,
  ProcessPaymentRequest,
  GetPaymentRequest,
  ListPaymentsRequest,
  ListPaymentsResponse,
  WatchPaymentsRequest,
  PaymentServiceClient,
  PaymentServiceController,
} from './generated/payment';
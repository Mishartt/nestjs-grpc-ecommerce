export * from './constants';

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
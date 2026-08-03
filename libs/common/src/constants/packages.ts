import { join } from 'path';

/** Nest ClientGrpc injection tokens */
export const PRODUCT_SERVICE = 'PRODUCT_SERVICE';
export const AUTH_SERVICE = 'AUTH_SERVICE';
export const ORDER_SERVICE = 'ORDER_SERVICE';
export const PAYMENT_SERVICE = 'PAYMENT_SERVICE';

/** Absolute paths to proto files (resolve from monorepo root / process.cwd()) */
export const PROTO_PATH = {
  product: join(process.cwd(), 'proto/product.proto'),
  auth: join(process.cwd(), 'proto/auth.proto'),
  order: join(process.cwd(), 'proto/order.proto'),
  payment: join(process.cwd(), 'proto/payment.proto'),
} as const;

/** gRPC server bind addresses (clients use *_SERVICE_URL env vars) */
export const GRPC_URL = {
  auth: process.env.AUTH_GRPC_BIND ?? '0.0.0.0:5000',
  product: process.env.PRODUCT_GRPC_BIND ?? '0.0.0.0:5001',
  order: process.env.ORDER_GRPC_BIND ?? '0.0.0.0:5002',
  payment: process.env.PAYMENT_GRPC_BIND ?? '0.0.0.0:5003',
} as const;

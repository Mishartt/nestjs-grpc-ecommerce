export const ORDER_EVENTS_CLIENT = 'ORDER_EVENTS_CLIENT';
export const ORDER_EVENTS_QUEUE = 'order.events';
export const ORDER_EVENT_PATTERN = 'order.updated';

export type OrderEventType =
  | 'order.created'
  | 'order.paid'
  | 'order.failed'
  | 'order.cancelled';

export type OrderEventItem = {
  name: string;
  quantity: number;
};

export type OrderStatusEvent = {
  type: OrderEventType;
  orderId: string;
  /** Prefer this in user-facing copy when present. */
  orderPublicId?: string;
  userId: string;
  status: string;
  totalAmount: number;
  occurredAt: string;
  items: OrderEventItem[];
};

export function orderEventType(status: string): OrderEventType | null {
  switch (status) {
    case 'PENDING':
      return 'order.created';
    case 'PAID':
      return 'order.paid';
    case 'FAILED':
      return 'order.failed';
    case 'CANCELLED':
      return 'order.cancelled';
    default:
      return null;
  }
}

export function rabbitmqUrl() {
  return process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
}

import type { Order } from '../../types';

/** Prefer public order number; fall back for legacy rows without one. */
export function orderPublicLabel(order: Pick<Order, 'id' | 'publicId'>): string {
  return order.publicId?.trim() || order.id.slice(0, 8);
}

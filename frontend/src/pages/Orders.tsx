import { useEffect, useState } from 'react';
import { ordersApi } from '../api/client';
import { patchById, useRealtimeBindings } from '../api/realtime';
import { useAuthStore } from '../shared/auth/store';
import { OrderItems } from '../shared/ui/OrderItems';
import { orderPublicLabel } from '../shared/ui/orderLabel';
import type { Order } from '../types';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function OrdersPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const res = await ordersApi.mine();
    setOrders(res.orders ?? []);
  }

  useEffect(() => {
    void reload()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      })
      .finally(() => setLoading(false));
  }, []);

  useRealtimeBindings({
    'order.updated': (order) => {
      if (order.userId !== userId) {
        return;
      }
      setOrders((prev) =>
        patchById(prev, { ...order, items: order.items ?? [] }),
      );
    },
  });

  async function copyOrderLabel(label: string) {
    try {
      await navigator.clipboard.writeText(label);
      setCopiedLabel(label);
      window.setTimeout(() => {
        setCopiedLabel((current) => (current === label ? null : current));
      }, 1600);
    } catch {
      setError('Could not copy order number');
    }
  }

  async function pay(orderId: string) {
    setError('');
    setPayingId(orderId);
    try {
      const res = await ordersApi.pay(orderId);
      setOrders((prev) => patchById(prev, res.order));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPayingId(null);
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>My orders</h1>
        <p className="muted">Live via WebSocket</p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && orders.length === 0 ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <ul className="stack">
          {orders.map((order) => {
            const label = orderPublicLabel(order);
            return (
              <li key={order.id} className="card order-card">
                <div className="order-head">
                  <button
                    type="button"
                    className="copy-id"
                    title="Copy order number"
                    onClick={() => void copyOrderLabel(label)}
                  >
                    {copiedLabel === label ? 'Copied' : `Order #${label}`}
                  </button>
                  <span className={`status status-${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                </div>
                <OrderItems items={order.items ?? []} />
                <div className="order-foot">
                  <strong>{money(order.totalAmount)}</strong>
                  {order.status === 'PENDING' ? (
                    <button
                      type="button"
                      disabled={payingId === order.id}
                      onClick={() => void pay(order.id)}
                    >
                      {payingId === order.id ? 'Paying…' : 'Pay'}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

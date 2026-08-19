import { useEffect, useState } from 'react';
import { ordersApi } from '../api/client';
import { patchById, useRealtimeBindings } from '../api/realtime';
import { useAuthStore } from '../shared/auth/store';
import type { Order } from '../types';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function OrdersPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
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
          {orders.map((order) => (
            <li key={order.id} className="card order-card">
              <div className="order-head">
                <code>{order.id}</code>
                <span className={`status status-${order.status.toLowerCase()}`}>
                  {order.status}
                </span>
              </div>
              <ul className="muted">
                {(order.items ?? []).map((item) => (
                  <li key={`${order.id}-${item.productId}`}>
                    {item.quantity} × {item.productId.slice(0, 8)}… @{' '}
                    {money(item.price)}
                  </li>
                ))}
              </ul>
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
          ))}
        </ul>
      )}
    </section>
  );
}

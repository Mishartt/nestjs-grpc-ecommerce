import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ordersApi, paymentsApi } from '../api/client';
import { patchById, useRealtimeBindings } from '../api/realtime';
import type { Order, Payment } from '../types';
import { useAuthStore } from '../shared/auth/store';
import { OrderItems } from '../shared/ui/OrderItems';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function OrderIdButton({ id }: { id: string }) {
  const [expanded, setExpanded] = useState(false);

  async function onClick() {
    setExpanded((current) => !current);
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      /* still show the full id in the table */
    }
  }

  return (
    <button
      type="button"
      className={`copy-id${expanded ? ' copy-id--full' : ''}`}
      title={expanded ? 'Hide full order id' : 'Show full order id'}
      onClick={() => void onClick()}
    >
      {expanded ? id : `#${id.slice(0, 8)}`}
    </button>
  );
}

export function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      return;
    }
    Promise.all([ordersApi.all(), paymentsApi.all()])
      .then(([orderRes, paymentRes]) => {
        setOrders(orderRes.orders ?? []);
        setPayments(paymentRes ?? []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load admin data');
      })
      .finally(() => setLoading(false));
  }, [user?.role]);

  useRealtimeBindings({
    'order.updated': (order) => {
      setOrders((prev) => {
        const existing = prev.find((row) => row.id === order.id);
        return patchById(prev, {
          ...order,
          items: order.items ?? [],
          userEmail: order.userEmail || existing?.userEmail,
        });
      });
    },
    'payment.created': (payment) => {
      setPayments((prev) => {
        const existing = prev.find((row) => row.id === payment.id);
        const fromOrder = ordersRef.current.find(
          (order) => order.userId === payment.userId,
        );
        return patchById(prev, {
          ...payment,
          userEmail:
            payment.userEmail || existing?.userEmail || fromOrder?.userEmail,
        });
      });
    },
  });

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return (
    <section>
      <div className="page-head">
        <h1>Admin</h1>
        <p className="muted">Live via WebSocket</p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}

      <h2>All orders</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <OrderIdButton id={order.id} />
                </td>
                <td>{order.userEmail || 'Unknown user'}</td>
                <td>
                  <OrderItems items={order.items ?? []} compact />
                </td>
                <td>{money(order.totalAmount)}</td>
                <td>
                  <span className={`status status-${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>All payments</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Payment</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>#{payment.id.slice(0, 8)}</td>
                <td>
                  <OrderIdButton id={payment.orderId} />
                </td>
                <td>{payment.userEmail || 'Unknown user'}</td>
                <td>{money(payment.amount)}</td>
                <td>
                  <span
                    className={`status status-${payment.status.toLowerCase()}`}
                  >
                    {payment.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

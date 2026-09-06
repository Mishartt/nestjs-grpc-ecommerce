import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ordersApi, paymentsApi } from '../api/client';
import { patchById, useRealtimeBindings } from '../api/realtime';
import type { Order, Payment } from '../types';
import { useAuthStore } from '../shared/auth/store';
import { OrderItems } from '../shared/ui/OrderItems';
import { orderPublicLabel } from '../shared/ui/orderLabel';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function OrderNumberButton({ label }: { label: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(label);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className="copy-id"
      title="Copy order number"
      onClick={() => void onClick()}
    >
      {copied ? 'Copied' : `#${label}`}
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
          (order) => order.id === payment.orderId,
        );
        return patchById(prev, {
          ...payment,
          userEmail:
            payment.userEmail || existing?.userEmail || fromOrder?.userEmail,
        });
      });
    },
  });

  function orderLabelForPayment(orderId: string) {
    const order = orders.find((row) => row.id === orderId);
    return order ? orderPublicLabel(order) : orderId.slice(0, 8);
  }

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
                  <OrderNumberButton label={orderPublicLabel(order)} />
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
                  <OrderNumberButton label={orderLabelForPayment(payment.orderId)} />
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

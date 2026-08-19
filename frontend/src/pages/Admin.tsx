import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ordersApi, paymentsApi } from '../api/client';
import { patchById, useRealtimeBindings } from '../api/realtime';
import type { Order, Payment } from '../types';
import { useAuthStore } from '../shared/auth/store';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
      setOrders((prev) =>
        patchById(prev, { ...order, items: order.items ?? [] }),
      );
    },
    'payment.created': (payment) => {
      setPayments((prev) => patchById(prev, payment));
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
              <th>Id</th>
              <th>User</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <code>{order.id.slice(0, 8)}</code>
                </td>
                <td>
                  <code>{order.userId.slice(0, 8)}</code>
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
              <th>Id</th>
              <th>Order</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  <code>{payment.id.slice(0, 8)}</code>
                </td>
                <td>
                  <code>{payment.orderId.slice(0, 8)}</code>
                </td>
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

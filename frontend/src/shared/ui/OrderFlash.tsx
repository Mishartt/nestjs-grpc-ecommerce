import { Link } from 'react-router-dom';

type Props = {
  label: string;
  status: string;
  title?: string;
  actionLabel?: string;
};

export function OrderFlash({
  label,
  status,
  title = 'Order placed',
  actionLabel = 'View orders',
}: Props) {
  const tone = status.toLowerCase();

  return (
    <div className={`order-flash order-flash--${tone}`}>
      <div className="order-flash-top">
        <span className="order-flash-title">{title}</span>
        <span className={`status status-${tone}`}>{status}</span>
      </div>
      <p className="order-flash-id">
        <span className="muted">#</span>
        {label}
      </p>
      <Link className="order-flash-link" to="/orders">
        {actionLabel}
      </Link>
    </div>
  );
}

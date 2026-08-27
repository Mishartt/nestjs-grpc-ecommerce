import type { OrderItem } from '../../types';

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

type Props = {
  items: OrderItem[];
  compact?: boolean;
};

export function OrderItems({ items, compact = false }: Props) {
  if (!items.length) {
    return <span className="muted">—</span>;
  }

  return (
    <ul className={`order-items${compact ? ' order-items--compact' : ''}`}>
      {items.map((item, index) => (
        <li key={`${item.productId}-${index}`} className="order-item">
          <span className="order-item-name">{item.productName || 'Product'}</span>
          <span className="order-item-meta">
            {item.quantity} × {money(item.price)}
          </span>
          {compact ? null : (
            <span className="order-item-sum">
              {money(item.price * item.quantity)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

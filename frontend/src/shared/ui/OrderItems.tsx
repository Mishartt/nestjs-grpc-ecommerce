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
      {items.map((item, index) => {
        const lineTotal = item.price * item.quantity;

        return (
          <li key={`${item.productId}-${index}`} className="order-item">
            <p className="order-item-label">
              <span className="order-item-name">
                {item.productName || 'Product'}
              </span>
              <span className="order-item-qty">× {item.quantity}</span>
            </p>
            <span className="order-item-sum">
              {money(compact ? item.price : lineTotal)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { OrderEventItem, OrderStatusEvent } from '@app/common';

type LetterCopy = {
  subject: string;
  title: string;
  summary: string;
  note?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get('MAIL_FROM') ?? 'shop@localhost';
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST') ?? 'localhost',
      port: Number(config.get('SMTP_PORT') ?? 1025),
      secure: false,
    });
  }

  async sendOrderEmail(to: string, event: OrderStatusEvent) {
    const { subject, text, html } = this.compose(event);
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
    this.logger.log(
      `Sent "${subject}" to ${to} (order ${event.orderPublicId || event.orderId})`,
    );
  }

  private compose(event: OrderStatusEvent) {
    const orderNo = event.orderPublicId || event.orderId.slice(0, 8);
    const total = this.money(event.totalAmount);
    const copy = this.copyFor(event.type, orderNo, total);
    const items = event.items ?? [];

    const text = [
      copy.title,
      '',
      copy.summary,
      '',
      'Items:',
      ...this.formatItemsText(items),
      '',
      `Total: ${total}`,
      `Order: #${orderNo}`,
      `Status: ${event.status}`,
      copy.note ? '' : null,
      copy.note ?? null,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');

    const html = `
      <div style="margin:0;padding:24px;background:#f4f5f7">
        <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;line-height:1.5">
          <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
            <p style="margin:0;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280">Order #${this.escape(orderNo)}</p>
            <h1 style="margin:6px 0 0;font-size:20px;font-weight:650;letter-spacing:-0.02em">${this.escape(copy.title)}</h1>
          </div>
          <div style="padding:20px 24px">
            <p style="margin:0 0 16px;color:#374151">${this.escape(copy.summary)}</p>
            ${this.formatItemsHtml(items)}
            <table style="width:100%;border-collapse:collapse;margin-top:16px">
              <tr>
                <td style="padding:8px 0;color:#6b7280">Total</td>
                <td style="padding:8px 0;text-align:right;font-weight:650">${this.escape(total)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280">Status</td>
                <td style="padding:8px 0;text-align:right;font-weight:600">${this.escape(event.status)}</td>
              </tr>
            </table>
            ${
              copy.note
                ? `<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px">${this.escape(copy.note)}</p>`
                : ''
            }
          </div>
        </div>
      </div>
    `.trim();

    return { subject: copy.subject, text, html };
  }

  private copyFor(
    type: OrderStatusEvent['type'],
    orderNo: string,
    total: string,
  ): LetterCopy {
    switch (type) {
      case 'order.paid':
        return {
          subject: `Payment received — order #${orderNo}`,
          title: 'Payment confirmed',
          summary: `We received ${total} for order #${orderNo}. Your order is paid and will be prepared for delivery.`,
        };
      case 'order.failed':
        return {
          subject: `Payment failed — order #${orderNo}`,
          title: 'Payment failed',
          summary: `We could not charge ${total} for order #${orderNo}. Nothing was taken from your account, and stock has been restored.`,
          note: 'You can place a new order whenever you are ready.',
        };
      case 'order.cancelled':
        return {
          subject: `Order cancelled — #${orderNo}`,
          title: 'Order cancelled',
          summary: `Order #${orderNo} was cancelled because payment was not completed in time. Reserved stock is back in the catalog, and you were not charged.`,
        };
      case 'order.created':
      default:
        return {
          subject: `Order received — #${orderNo}`,
          title: 'Order received',
          summary: `Thanks — we reserved your items for order #${orderNo}. Complete payment of ${total} to confirm the order.`,
          note: 'Unpaid orders expire automatically and stock is released.',
        };
    }
  }

  private money(value: number) {
    return `$${Number(value).toFixed(2)}`;
  }

  private formatItemsText(items: OrderEventItem[]) {
    if (!items.length) {
      return ['- (no items)'];
    }
    return items.map((item) => {
      const name = item.name || 'Item';
      return `- ${name} × ${item.quantity}`;
    });
  }

  private formatItemsHtml(items: OrderEventItem[]) {
    if (!items.length) {
      return '<p style="margin:0;color:#6b7280">No items</p>';
    }

    const rows = items
      .map(
        (item) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6">${this.escape(item.name || 'Item')}</td>
            <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;color:#6b7280;white-space:nowrap">× ${item.quantity}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="text-align:left;padding:0 0 8px;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#9ca3af;font-weight:600">Item</th>
            <th style="text-align:right;padding:0 0 8px;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#9ca3af;font-weight:600">Qty</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  private escape(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { OrderEventItem, OrderStatusEvent } from '@app/common';

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
    this.logger.log(`Sent "${subject}" to ${to} (order ${event.orderId})`);
  }

  private compose(event: OrderStatusEvent) {
    const total = `$${Number(event.totalAmount).toFixed(2)}`;
    const shortId = event.orderId.slice(0, 8);
    const items = this.formatItems(event.items ?? []);
    const itemsHtml = this.formatItemsHtml(event.items ?? []);

    if (event.type === 'order.paid') {
      return this.letter({
        subject: `It's on the way — we packed your order #${shortId}`,
        greeting: 'Payment landed. Time to ship.',
        body: [
          `We've packed your ${items} and handed the box to the courier.`,
          `Total charged: ${total}. Sit tight — your order is on the road and should be with you soon.`,
        ],
        itemsHtml,
        footer: `Order #${event.orderId}`,
      });
    }

    if (event.type === 'order.failed') {
      return this.letter({
        subject: `We couldn't charge the card for order #${shortId}`,
        greeting: "The payment didn't go through.",
        body: [
          `Nothing was taken from your account. Your ${items} went straight back on the shelf.`,
          `Want to try again? Place a new order whenever you're ready — ${total} is still waiting.`,
        ],
        itemsHtml,
        footer: `Order #${event.orderId}`,
      });
    }

    if (event.type === 'order.cancelled') {
      return this.letter({
        subject: `We had to let order #${shortId} go`,
        greeting: 'This one expired before checkout.',
        body: [
          `We held your ${items} for you, but payment never arrived.`,
          `The reservation timed out, stock is back in the catalog, and nobody was charged. Come back any time and we'll set it aside again.`,
        ],
        itemsHtml,
        footer: `Order #${event.orderId}`,
      });
    }

    return this.letter({
      subject: `We've got your order #${shortId} — just waiting on payment`,
      greeting: 'Thanks for shopping with us.',
      body: [
        `Your ${items} ${this.isPlural(event.items) ? 'are' : 'is'} reserved and sitting in our warehouse.`,
        `Pay ${total} in the next few minutes and we'll pack it up and send it on its way.`,
      ],
      itemsHtml,
      footer: `Order #${event.orderId}`,
    });
  }

  private letter(opts: {
    subject: string;
    greeting: string;
    body: string[];
    itemsHtml: string;
    footer: string;
  }) {
    const text = [opts.greeting, '', ...opts.body, '', opts.footer].join('\n');
    const html = `
      <div style="font-family:Georgia,serif;max-width:520px;line-height:1.5;color:#1a1a1a">
        <p style="font-size:18px;margin:0 0 12px">${this.escape(opts.greeting)}</p>
        ${opts.body.map((p) => `<p style="margin:0 0 12px">${this.escape(p)}</p>`).join('')}
        ${opts.itemsHtml}
        <p style="margin:16px 0 0;color:#666;font-size:13px">${this.escape(opts.footer)}</p>
      </div>
    `.trim();
    return { subject: opts.subject, text, html };
  }

  private formatItems(items: OrderEventItem[]) {
    if (!items.length) {
      return 'items';
    }
    const parts = items.map((item) => {
      const name = item.name || 'item';
      return item.quantity > 1 ? `${name} × ${item.quantity}` : name;
    });
    if (parts.length === 1) {
      return parts[0];
    }
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  }

  private formatItemsHtml(items: OrderEventItem[]) {
    if (!items.length) {
      return '';
    }
    const rows = items
      .map(
        (item) =>
          `<li>${this.escape(item.name || 'item')}${
            item.quantity > 1 ? ` × ${item.quantity}` : ''
          }</li>`,
      )
      .join('');
    return `<ul style="margin:0 0 12px;padding-left:18px">${rows}</ul>`;
  }

  private isPlural(items?: OrderEventItem[]) {
    if (!items?.length) {
      return true;
    }
    return items.length > 1 || items[0].quantity > 1;
  }

  private escape(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

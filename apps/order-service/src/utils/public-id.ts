import { randomBytes } from 'crypto';

/** Crockford-ish alphabet: no 0/O/1/I to keep IDs easy to read aloud. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Human-facing order number, e.g. ORD-A7K2M9QX */
export function generateOrderPublicId(): string {
  const bytes = randomBytes(8);
  let body = '';
  for (const byte of bytes) {
    body += ALPHABET[byte % ALPHABET.length];
  }
  return `ORD-${body}`;
}

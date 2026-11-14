import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Time-sortable id: 9 chars of millisecond time + 12 random chars.
 * Ids created later sort after earlier ones (useful for audit and append-only logs).
 */
export function newId(now: Date = new Date()): string {
  const time = now.getTime().toString(36).padStart(9, '0');
  let rand = '';
  for (const b of randomBytes(12)) rand += ALPHABET[b % 36];
  return `${time}${rand}`;
}

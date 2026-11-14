/**
 * Money utilities. Every amount in the system is an integer number of cents (LKR × 100).
 * This is the only module allowed to parse, format or do arithmetic on money.
 */

export type Cents = number;

export class MoneyError extends Error {
  override name = 'MoneyError';
}

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertCents(value: unknown, label = 'amount'): asserts value is Cents {
  if (!isCents(value)) {
    throw new MoneyError(`${label} must be an integer number of cents, got ${String(value)}`);
  }
}

/** Sum any number of amounts. */
export function sum(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total, 'sum');
  return total;
}

export function add(a: Cents, b: Cents): Cents {
  return sum([a, b]);
}

export function subtract(a: Cents, b: Cents): Cents {
  assertCents(a);
  assertCents(b);
  const r = a - b;
  assertCents(r, 'difference');
  return r;
}

/** Unit price × integer quantity. */
export function multiply(unit: Cents, qty: number): Cents {
  assertCents(unit, 'unit price');
  if (!Number.isSafeInteger(qty)) throw new MoneyError(`quantity must be an integer, got ${qty}`);
  const r = unit * qty;
  assertCents(r, 'line total');
  return r;
}

/** Integer division rounding half away from zero. */
function divRoundHalfUp(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const q = Math.floor(n / d);
  const r = n - q * d;
  return sign * (r * 2 >= d ? q + 1 : q);
}

/**
 * Percentage of an amount, rounded half-up to the nearest cent.
 * `pct` may have up to 2 decimals (e.g. 2.5 for 2.5%).
 */
export function percentOf(amount: Cents, pct: number): Cents {
  assertCents(amount);
  const basisPoints = Math.round(pct * 100);
  if (Math.abs(pct * 100 - basisPoints) > 1e-9) {
    throw new MoneyError(`percentage supports at most 2 decimals, got ${pct}`);
  }
  return divRoundHalfUp(amount * basisPoints, 10_000);
}

/**
 * Tax contained in a tax-inclusive amount: amount × rate / (100 + rate).
 */
export function inclusiveTax(amount: Cents, ratePct: number): Cents {
  assertCents(amount);
  const bp = Math.round(ratePct * 100);
  return divRoundHalfUp(amount * bp, 10_000 + bp);
}

/**
 * Split an amount into parts proportional to `ratios` without losing a cent.
 * Remainder cents go to the parts with the largest fractional share (largest remainder method).
 */
export function allocate(amount: Cents, ratios: readonly number[]): Cents[] {
  assertCents(amount);
  if (ratios.length === 0) throw new MoneyError('allocate needs at least one ratio');
  if (ratios.some((r) => r < 0 || !Number.isFinite(r))) throw new MoneyError('ratios must be >= 0');
  const total = ratios.reduce((a, b) => a + b, 0);
  if (total === 0) throw new MoneyError('ratios must not all be zero');
  const sign = amount < 0 ? -1 : 1;
  const abs = Math.abs(amount);
  const raw = ratios.map((r) => (abs * r) / total);
  const parts = raw.map((x) => Math.floor(x));
  let remainder = abs - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    const idx = order[k]!.i;
    parts[idx] = parts[idx]! + 1;
  }
  return parts.map((p) => p * sign);
}

/**
 * Parse a rupee amount typed by a person ("1,250", "1250.5", "LKR 1,250.00", "-20")
 * into cents, exactly (no floating point).
 */
export function parseRupees(input: string | number): Cents {
  const text = typeof input === 'number' ? numberToPlainString(input) : input;
  const cleaned = text.replace(/LKR|Rs\.?|රු|ரூ|,|\s/gi, '');
  const m = /^(-)?(\d*)(?:\.(\d{0,2})\d*)?$/.exec(cleaned);
  if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
    throw new MoneyError(`not a valid amount: "${text}"`);
  }
  if (m[3] !== undefined && cleaned.split('.')[1]!.length > 2) {
    throw new MoneyError(`amount has more than 2 decimals: "${text}"`);
  }
  const whole = m[2] === '' ? 0 : Number(m[2]);
  const frac = Number((m[3] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + frac;
  assertCents(cents);
  return m[1] ? -cents : cents;
}

/** Like parseRupees but returns null instead of throwing. */
export function tryParseRupees(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined || input === '') return null;
  try {
    return parseRupees(input);
  } catch {
    return null;
  }
}

function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) throw new MoneyError(`not a finite number: ${n}`);
  // toFixed(2) is safe for display-range values; reject anything with more precision.
  const fixed = n.toFixed(2);
  if (Math.abs(Number(fixed) - n) > 1e-9) throw new MoneyError(`amount has more than 2 decimals: ${n}`);
  return fixed;
}

/** Rupees and cents as a plain string for inputs: 125050 → "1250.50". */
export function toRupeesString(amount: Cents): string {
  assertCents(amount);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const groupFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export interface FormatOptions {
  /** Show the "LKR" prefix (default true). */
  currency?: boolean;
  /** Hide ".00" when there are no cents (default false). */
  compactZeroCents?: boolean;
}

/** Format for display: 125000 → "LKR 1,250.00". Negative → "-LKR 1,250.00". */
export function formatLKR(amount: Cents, opts: FormatOptions = {}): string {
  assertCents(amount);
  const { currency = true, compactZeroCents = false } = opts;
  const abs = Math.abs(amount);
  const whole = groupFormatter.format(Math.floor(abs / 100));
  const frac = abs % 100;
  const body = compactZeroCents && frac === 0 ? whole : `${whole}.${String(frac).padStart(2, '0')}`;
  return `${amount < 0 ? '-' : ''}${currency ? 'LKR ' : ''}${body}`;
}

/** Short form for charts: 1250000 → "12.5k". */
export function formatCompact(amount: Cents): string {
  assertCents(amount);
  const rupees = amount / 100;
  const abs = Math.abs(rupees);
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (abs >= 1_000_000) return `${trim((rupees / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1))}M`;
  if (abs >= 1_000) return `${trim((rupees / 1_000).toFixed(abs >= 100_000 ? 0 : 1))}k`;
  return String(Math.round(rupees));
}

export const rupees = (r: number): Cents => parseRupees(r);

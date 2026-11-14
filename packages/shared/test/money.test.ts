import { describe, expect, it } from 'vitest';
import {
  add,
  allocate,
  formatCompact,
  formatLKR,
  inclusiveTax,
  multiply,
  MoneyError,
  parseRupees,
  percentOf,
  subtract,
  sum,
  toRupeesString,
  tryParseRupees,
} from '../src/money';

describe('money arithmetic', () => {
  it('adds, subtracts and sums integer cents exactly', () => {
    expect(add(10, 20)).toBe(30);
    expect(subtract(100, 250)).toBe(-150);
    expect(sum([75000, 25000, 50000 * 2])).toBe(200000);
    expect(sum([])).toBe(0);
  });

  it('avoids float drift that broke split payments in the old app', () => {
    // 0.1 + 0.2 in rupees
    expect(add(parseRupees('0.10'), parseRupees('0.20'))).toBe(30);
  });

  it('rejects non-integer amounts', () => {
    expect(() => add(1.5, 1)).toThrow(MoneyError);
    expect(() => sum([Number.NaN])).toThrow(MoneyError);
    expect(() => multiply(100, 1.5)).toThrow(MoneyError);
  });

  it('multiplies unit price by quantity', () => {
    expect(multiply(25000, 3)).toBe(75000);
    expect(multiply(25000, 0)).toBe(0);
  });

  it('computes percentages rounding half-up', () => {
    expect(percentOf(100000, 50)).toBe(50000);
    expect(percentOf(333, 50)).toBe(167); // 166.5 → 167
    expect(percentOf(-333, 50)).toBe(-167);
    expect(percentOf(100000, 2.5)).toBe(2500);
    expect(percentOf(100001, 8)).toBe(8000); // 8000.08
    expect(() => percentOf(100, 1.234)).toThrow(MoneyError);
  });

  it('extracts inclusive tax', () => {
    // 1,180.00 incl. 18% → 180.00
    expect(inclusiveTax(118000, 18)).toBe(18000);
    expect(inclusiveTax(0, 18)).toBe(0);
  });

  it('allocates without losing a cent', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(allocate(1000, [70, 30])).toEqual([700, 300]);
    const parts = allocate(99999, [3, 5, 7]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(99999);
    expect(() => allocate(100, [0, 0])).toThrow(MoneyError);
    expect(() => allocate(100, [])).toThrow(MoneyError);
  });
});

describe('parsing', () => {
  it.each([
    ['1250', 125000],
    ['1,250', 125000],
    ['1,250.5', 125050],
    ['1250.05', 125005],
    ['LKR 1,250.00', 125000],
    ['Rs. 500', 50000],
    ['.5', 50],
    ['-20', -2000],
    ['0', 0],
  ])('parses %s', (input, cents) => {
    expect(parseRupees(input)).toBe(cents);
  });

  it('parses numbers with at most 2 decimals', () => {
    expect(parseRupees(1250.5)).toBe(125050);
    expect(parseRupees(0.1)).toBe(10);
    expect(() => parseRupees(1.005)).toThrow(MoneyError);
  });

  it.each(['', 'abc', '1.2.3', '1.234', '-', '.'])('rejects %j', (input) => {
    expect(() => parseRupees(input)).toThrow(MoneyError);
  });

  it('tryParse returns null for bad input', () => {
    expect(tryParseRupees('x')).toBeNull();
    expect(tryParseRupees('')).toBeNull();
    expect(tryParseRupees(undefined)).toBeNull();
    expect(tryParseRupees('10')).toBe(1000);
  });
});

describe('formatting', () => {
  it('formats LKR with grouping and two decimals', () => {
    expect(formatLKR(125000)).toBe('LKR 1,250.00');
    expect(formatLKR(5)).toBe('LKR 0.05');
    expect(formatLKR(-125050)).toBe('-LKR 1,250.50');
    expect(formatLKR(123456789)).toBe('LKR 1,234,567.89');
    expect(formatLKR(125000, { currency: false })).toBe('1,250.00');
    expect(formatLKR(125000, { compactZeroCents: true })).toBe('LKR 1,250');
  });

  it('round-trips through the input string', () => {
    for (const v of [0, 5, 99, 100, 125050, -2000]) {
      expect(parseRupees(toRupeesString(v))).toBe(v);
    }
  });

  it('compacts large values for charts', () => {
    expect(formatCompact(1250000)).toBe('12.5k');
    expect(formatCompact(150000000)).toBe('1.5M');
    expect(formatCompact(50000)).toBe('500');
  });
});

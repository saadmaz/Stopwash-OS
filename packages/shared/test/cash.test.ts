import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, denominationTotal } from '../src';

const D = DEFAULT_SETTINGS.denominations;

describe('denominationTotal', () => {
  it('sums notes (LKR 2,000 included) and coins exactly', () => {
    // 2×5000 + 1×2000 + 3×1000 + 1×500 + 4×100 + coins 123.50
    const total = denominationTotal(D, {
      notes: { '500000': 2, '200000': 1, '100000': 3, '50000': 1, '10000': 4 },
      coinsCents: 12350,
    });
    expect(total).toBe(1602350);
  });

  it('ignores zero counts and rejects unknown denominations', () => {
    expect(denominationTotal(D, { notes: { '7': 0 }, coinsCents: 0 })).toBe(0);
    expect(() => denominationTotal(D, { notes: { '700': 1 }, coinsCents: 0 })).toThrow(/Unknown/);
  });
});

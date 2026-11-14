import { describe, expect, it } from 'vitest';
import { reconcile, type ReconcileInput } from '../src';

const thresholds = { explainAboveCents: 50_000, overrideAboveCents: 200_000 };

const base: ReconcileInput = {
  openingCents: 1_000_000, // LKR 10,000 float
  payments: [
    { method: 'CASH', amountCents: 75_000 },
    { method: 'CASH', amountCents: 125_000 },
    { method: 'CARD', amountCents: 100_000 },
    { method: 'CASH', amountCents: 40_000 }, // split: cash part
    { method: 'CARD', amountCents: 60_000 }, // split: card part
  ],
  cashMovements: [
    { type: 'EXPENSE', amountCents: 150_000 },
    { type: 'DEPOSIT', amountCents: 500_000 },
  ],
  countedCents: null,
  thresholds,
};

describe('reconcile (SWOMS formula)', () => {
  it('expected = opening + cash sales − expenses − deposits', () => {
    const r = reconcile(base);
    expect(r).toMatchObject({
      cashSalesCents: 240_000,
      cardSalesCents: 160_000,
      totalSalesCents: 400_000,
      expensesCents: 150_000,
      depositsCents: 500_000,
      expectedCents: 590_000, // 10,000 + 2,400 − 1,500 − 5,000
      varianceCents: null,
      label: null,
      needsExplanation: false,
    });
  });

  it('card sales never change the drawer', () => {
    const more = reconcile({
      ...base,
      payments: [...base.payments, { method: 'CARD', amountCents: 999_900 }],
    });
    expect(more.expectedCents).toBe(590_000);
  });

  it('refunds and reversed expenses net out', () => {
    const r = reconcile({
      ...base,
      payments: [...base.payments, { method: 'CASH', amountCents: -75_000 }],
      cashMovements: [...base.cashMovements, { type: 'EXPENSE', amountCents: -150_000 }],
    });
    expect(r.cashSalesCents).toBe(165_000);
    expect(r.expensesCents).toBe(0);
    expect(r.expectedCents).toBe(665_000);
  });

  it.each([
    [590_000, 0, 'MATCHED', false, false],
    [589_999, -1, 'SHORTAGE', false, false],
    [540_000, -50_000, 'SHORTAGE', false, false], // exactly LKR 500: no explanation (old rule was "> 500")
    [539_999, -50_001, 'SHORTAGE', true, false],
    [790_000, 200_000, 'OVERAGE', true, false], // exactly LKR 2,000: explanation, no override
    [790_001, 200_001, 'OVERAGE', true, true],
    [380_000, -210_000, 'SHORTAGE', true, true],
  ] as const)(
    'counted %i → variance %i %s (explain %s, override %s)',
    (counted, variance, label, explain, override) => {
      const r = reconcile({ ...base, countedCents: counted });
      expect(r.varianceCents).toBe(variance);
      expect(r.label).toBe(label);
      expect(r.needsExplanation).toBe(explain);
      expect(r.needsOverride).toBe(override);
    },
  );

  it('tracks other tender types separately', () => {
    const r = reconcile({ ...base, payments: [{ method: 'BANK_TRANSFER', amountCents: 30_000 }] });
    expect(r).toMatchObject({
      otherSalesCents: 30_000,
      cashSalesCents: 0,
      totalSalesCents: 30_000,
    });
  });
});

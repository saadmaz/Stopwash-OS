import { describe, expect, it } from 'vitest';
import { analyticsWindow, retention, salesStats, type SaleLike } from '../src';

const o = (
  businessDate: string,
  plateKey: string,
  totalCents: number,
  codes = ['SMALL'],
): SaleLike => ({
  businessDate,
  plateKey,
  totalCents,
  lines: codes.map((code) => ({ code })),
});

describe('analyticsWindow', () => {
  it('builds inclusive windows with an equal previous window', () => {
    expect(analyticsWindow('WEEKLY', '2026-11-15')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
      prevFrom: '2026-11-02',
      prevTo: '2026-11-08',
    });
    expect(analyticsWindow('YEARLY', '2026-11-15').from).toBe('2025-11-16'); // was broken in SWOMS
    const c = analyticsWindow('CUSTOM', '2026-11-15', { from: '2026-11-01', to: '2026-11-10' });
    expect([c.prevFrom, c.prevTo]).toEqual(['2026-10-22', '2026-10-31']);
    expect(() =>
      analyticsWindow('CUSTOM', '2026-11-15', { from: '2026-11-10', to: '2026-11-01' }),
    ).toThrow();
  });
});

describe('salesStats', () => {
  const orders = [
    o('2026-11-14', 'A', 100000, ['MEDIUM', 'WAX']),
    o('2026-11-15', 'B', 75000),
    o('2026-11-15', 'C', 50000, ['AIR_FRESHENER']),
    o('2026-11-05', 'D', 100000),
  ];
  const w = analyticsWindow('WEEKLY', '2026-11-15');

  it('compares revenue, count and average ticket with the previous period', () => {
    const s = salesStats(orders, w);
    expect(s.current).toEqual({ count: 3, revenueCents: 225000, avgTicketCents: 75000 });
    expect(s.previous.revenueCents).toBe(100000);
    expect(s.changePct).toBe(125);
    expect(s.series).toHaveLength(7);
    expect(s.series.at(-1)).toEqual({ date: '2026-11-15', count: 2, revenueCents: 125000 });
  });

  it('filters by item (SWOMS product filter)', () => {
    expect(salesStats(orders, w, 'WAX').current.count).toBe(1);
    expect(salesStats(orders, w, 'NOPE').changePct).toBeNull();
  });
});

describe('retention', () => {
  it('counts unique plates and returning vs new like SWOMS', () => {
    const orders = [
      o('2026-10-01', 'A', 1),
      o('2026-11-10', 'A', 1),
      o('2026-11-11', 'A', 1), // same plate twice in window counts once
      o('2026-11-12', 'B', 1),
      o('2026-11-13', 'C', 1),
      o('2026-11-01', 'C', 1),
    ];
    expect(retention(orders, { from: '2026-11-09', to: '2026-11-15' })).toEqual({
      returning: 2,
      new: 1,
      total: 3,
      retentionPct: 67,
      newPct: 33,
    });
    expect(retention([], { from: '2026-11-09', to: '2026-11-15' }).retentionPct).toBe(0);
  });
});

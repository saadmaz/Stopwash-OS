import { randomUUID } from 'node:crypto';
import type { Order } from '@stopwash/shared';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

/** Inserts completed orders directly so tests control the business day. */
async function completed(
  store: Awaited<ReturnType<typeof testApp>>['store'],
  day: string,
  n: number,
) {
  for (let i = 0; i < n; i++) {
    await store.orders.insert({
      id: `${day}-${i}`,
      brandId: 'stopwash',
      locationId: 'katubedda',
      businessDate: day,
      status: 'COMPLETED',
    } as Order);
  }
}

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const manager = await authHeader(app, 'e2', '7391');
  const cashier = await authHeader(app, 'e1', '4826');
  const post = (url: string, payload: Record<string, unknown>, h = manager) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  const rule = (
    await post('/incentive-rules', {
      name: 'Standard',
      weekdayTiers: [{ target: 10, bonusCents: 25000 }],
      weekendTiers: [{ target: 15, bonusCents: 50000 }],
    })
  ).json();
  await store.employees.update('e1', { incentiveRuleId: rule.id });
  await completed(store, '2026-11-02', 12); // Monday: weekday tier
  await completed(store, '2026-11-07', 15); // Saturday: weekend tier
  await completed(store, '2026-11-08', 9); // Sunday: nothing
  return { app, store, manager, cashier, post };
}

describe('payroll runs', () => {
  it('previews payslips with incentives from shop daily counts', async () => {
    const { app, manager } = await setup();
    const res = (
      await app.inject({ url: '/payroll/preview?period=2026-11', headers: manager })
    ).json();
    const kasun = res.lines.find((l: { employeeId: string }) => l.employeeId === 'e1');
    expect(kasun.incentiveCents).toBe(75000);
    expect(kasun.netCents).toBe(4500000 + 75000);
    expect(res.totals.netCents).toBeGreaterThan(0);
  });

  it('finalizes once; later corrections need a supplementary run', async () => {
    const { post, app, manager } = await setup();
    const run = await post('/payroll/runs', { period: '2026-11' });
    expect(run.statusCode).toBe(201);
    expect(run.json().kind).toBe('REGULAR');
    expect((await post('/payroll/runs', { period: '2026-11' })).json().error.code).toBe(
      'PERIOD_ALREADY_FINALIZED',
    );
    const adj = await post('/payroll-adjustments', {
      employeeId: 'e1',
      date: '2026-11-20',
      kind: 'DEDUCTION',
      category: 'FOOD',
      amountCents: 1000,
      reason: 'late entry',
    });
    expect(adj.json().error.code).toBe('PERIOD_ALREADY_FINALIZED');
    const supp = await post('/payroll/runs', { period: '2026-11', kind: 'SUPPLEMENTARY' });
    expect(supp.json()).toMatchObject({ kind: 'SUPPLEMENTARY', supersedesId: run.json().id });
    const runs = (
      await app.inject({ url: '/payroll/runs?period=2026-11', headers: manager })
    ).json();
    expect(runs.items).toHaveLength(2);
  });

  it('cashiers cannot see payroll', async () => {
    const { app, cashier } = await setup();
    expect(
      (await app.inject({ url: '/payroll/preview?period=2026-11', headers: cashier })).statusCode,
    ).toBe(403);
  });
});

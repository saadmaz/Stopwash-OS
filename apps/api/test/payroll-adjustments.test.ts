import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

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
  return { app, store, manager, cashier, post };
}

const advance = {
  employeeId: 'e1',
  date: '2026-11-12',
  kind: 'DEDUCTION',
  category: 'ADVANCE',
  amountCents: 500000,
  reason: 'Salary advance',
};

describe('payroll adjustments', () => {
  it('records deductions and ± bonus adjustments in the right period', async () => {
    const { post, app, manager } = await setup();
    expect((await post('/payroll-adjustments', advance)).json()).toMatchObject({
      period: '2026-11',
    });
    const minus = await post('/payroll-adjustments', {
      ...advance,
      kind: 'BONUS',
      category: 'Late',
      amountCents: -25000,
      reason: 'Late twice',
    });
    expect(minus.statusCode).toBe(201);
    const list = await app.inject({ url: '/payroll-adjustments?period=2026-11', headers: manager });
    expect(list.json().items).toHaveLength(2);
  });

  it('validates deduction sign, category and permission', async () => {
    const { post, cashier } = await setup();
    expect((await post('/payroll-adjustments', { ...advance, amountCents: -1 })).statusCode).toBe(
      400,
    );
    expect((await post('/payroll-adjustments', { ...advance, category: 'BEER' })).statusCode).toBe(
      400,
    );
    expect((await post('/payroll-adjustments', advance, cashier)).statusCode).toBe(403);
  });

  it('reverses once, never deletes', async () => {
    const { post, store } = await setup();
    const a = (await post('/payroll-adjustments', advance)).json();
    const r = await post(`/payroll-adjustments/${a.id}/reverse`, { reason: 'Entered twice' });
    expect(r.json()).toMatchObject({ amountCents: -500000, reversesId: a.id });
    expect((await post(`/payroll-adjustments/${a.id}/reverse`, { reason: 'x' })).statusCode).toBe(
      409,
    );
    const all = await store.payrollAdjustments.find({
      where: [{ field: 'brandId', op: '==', value: 'stopwash' }],
    });
    expect(all).toHaveLength(2);
  });
});

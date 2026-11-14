import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, openTestShift, seedBasics, testApp } from './helpers';

async function setup({ shift = true } = {}) {
  const { app, store } = await testApp();
  await seedBasics(store);
  if (shift) await openTestShift(store);
  const cashier = await authHeader(app, 'e1', '4826');
  const manager = await authHeader(app, 'e2', '7391');
  const post = (url: string, payload: Record<string, unknown>, h = cashier) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  return { app, store, cashier, manager, post };
}

const expense = {
  type: 'EXPENSE',
  categoryId: 'stopwash__e001',
  amountCents: 150000,
  paidTo: 'Hardware store',
  description: 'Shampoo 5L',
};

describe('POST /cash-movements', () => {
  it('records an expense against the open shift', async () => {
    const { post, app, cashier } = await setup();
    const res = await post('/cash-movements', expense);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      shiftId: 'shift-1',
      categoryCode: 'E001',
      amountCents: 150000,
      approvedByEmployeeId: null,
    });
    const list = (await app.inject({ url: '/cash-movements', headers: cashier })).json();
    expect(list.items).toHaveLength(1);
  });

  it('needs an open shift and a matching category', async () => {
    const noShift = await setup({ shift: false });
    expect((await noShift.post('/cash-movements', expense)).json().error.code).toBe(
      'SHIFT_NOT_OPEN',
    );
    const { post } = await setup();
    const res = await post('/cash-movements', { ...expense, type: 'DEPOSIT' }); // E001 is an expense category
    expect(res.statusCode).toBe(400);
  });

  it('large amounts need a manager PIN, and the approver is stored (old app saved "N/A")', async () => {
    const { post } = await setup();
    const big = {
      type: 'DEPOSIT',
      categoryId: 'stopwash__d001',
      amountCents: 2500000,
      paidTo: 'Bank',
    };
    expect((await post('/cash-movements', big)).json().error.code).toBe('OVERRIDE_REQUIRED');
    expect(
      (
        await post('/cash-movements', { ...big, override: { employeeId: 'e1', pin: '4826' } })
      ).json().error.code,
    ).toBe('OVERRIDE_INVALID');
    const ok = await post('/cash-movements', {
      ...big,
      override: { employeeId: 'e2', pin: '7391' },
    });
    expect(ok.json().approvedByEmployeeId).toBe('e2');
  });
});

describe('POST /cash-movements/:id/reverse', () => {
  it('appends a negative entry once, manager only', async () => {
    const { post, store, manager } = await setup();
    const e = (await post('/cash-movements', expense)).json();
    expect(
      (await post(`/cash-movements/${e.id}/reverse`, { reason: 'Wrong amount' })).statusCode,
    ).toBe(403);
    const r = await post(`/cash-movements/${e.id}/reverse`, { reason: 'Wrong amount' }, manager);
    expect(r.json()).toMatchObject({
      amountCents: -150000,
      reversesId: e.id,
      reason: 'Wrong amount',
    });
    expect(
      (await post(`/cash-movements/${e.id}/reverse`, { reason: 'again' }, manager)).statusCode,
    ).toBe(409);
    const all = await store.cashMovements.find({
      where: [{ field: 'brandId', op: '==', value: 'stopwash' }],
    });
    expect(all.reduce((s, m) => s + m.amountCents, 0)).toBe(0);
  });
});

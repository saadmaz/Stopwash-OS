import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

/** Opens with LKR 10,000, closes LKR 300 short with an explanation. */
async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const cashier = await authHeader(app, 'e1', '4826');
  const manager = await authHeader(app, 'e2', '7391');
  const accounts = await authHeader(app, 'e3', '5038');
  const post = (url: string, payload: Record<string, unknown>, h = cashier) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  const shift = (
    await post('/shifts', {
      supervisorEmployeeId: 'e2',
      openingCount: { notes: { '100000': 10 }, coinsCents: 0 },
    })
  ).json();
  await post(`/shifts/${shift.id}/close`, {
    closingCount: { notes: { '100000': 9 }, coinsCents: 70000 },
    handover: { employeeId: 'e2', pin: '7391' },
  });
  return { app, store, shift, cashier, manager, accounts, post };
}

describe('shift history and corrections', () => {
  it('lists shifts newest first with their close', async () => {
    const { app, cashier, shift } = await setup();
    const res = (await app.inject({ url: '/shifts', headers: cashier })).json();
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({
      shift: { id: shift.id },
      close: { varianceCents: -30000 },
    });
  });

  it('a forgotten expense is back-dated onto the closed shift and fixed by an adjustment', async () => {
    const { post, shift, manager, cashier, store, app } = await setup();
    const forgotten = {
      type: 'EXPENSE',
      categoryId: 'stopwash__e004',
      amountCents: 30000,
      paidTo: 'Canteen',
      targetShiftId: shift.id,
    };
    expect((await post('/cash-movements', forgotten)).statusCode).toBe(403); // cashier
    const entry = await post('/cash-movements', forgotten, manager);
    expect(entry.json()).toMatchObject({ backdated: true, shiftId: shift.id });
    expect((await post(`/shifts/${shift.id}/adjust`, { reason: 'x' }, cashier)).statusCode).toBe(
      403,
    );
    const adj = await post(
      `/shifts/${shift.id}/adjust`,
      { reason: 'Staff meal receipt found' },
      manager,
    );
    expect(adj.json()).toMatchObject({
      kind: 'ADJUSTMENT',
      expensesCents: 30000,
      varianceCents: 0,
    });
    const closes = await store.shiftCloses.find({
      where: [{ field: 'brandId', op: '==', value: 'stopwash' }],
    });
    expect(closes.map((c) => c.kind)).toEqual(['CLOSE', 'ADJUSTMENT']); // original untouched
    const hist = (await app.inject({ url: '/shifts', headers: cashier })).json();
    expect(hist.items[0].latest.varianceCents).toBe(0);
  });

  it('approved shifts are locked', async () => {
    const { post, shift, manager, accounts } = await setup();
    await post(`/shifts/${shift.id}/decision`, { decision: 'APPROVED' }, accounts);
    const res = await post(`/shifts/${shift.id}/adjust`, { reason: 'Late fix' }, manager);
    expect(res.statusCode).toBe(409);
  });
});

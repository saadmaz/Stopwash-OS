import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const cashier = await authHeader(app, 'e1', '4826');
  const accounts = await authHeader(app, 'e3', '5038');
  const manager = await authHeader(app, 'e2', '7391');
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
  await post('/cash-movements', {
    type: 'EXPENSE',
    categoryId: 'stopwash__e001',
    amountCents: 30000,
    paidTo: 'Shop',
  });
  await post(`/shifts/${shift.id}/close`, {
    closingCount: { notes: { '100000': 9 }, coinsCents: 60000 }, // expected 9,700 counted 9,600 → −100
    handover: { employeeId: 'e2', pin: '7391' },
  });
  return { app, shift, cashier, accounts, manager, post };
}

describe('accounts approvals', () => {
  it('lists pending shifts with KPIs, including expenses (always 0 in the old app)', async () => {
    const { app, accounts } = await setup();
    const res = (await app.inject({ url: '/approvals', headers: accounts })).json();
    expect(res.rows).toHaveLength(1);
    expect(res.kpis).toEqual({
      pendingCount: 1,
      expectedCents: 970000,
      countedCents: 960000,
      expensesCents: 30000,
      varianceCents: -10000,
    });
  });

  it('accounts can query, then approve; approved shifts leave the pending list', async () => {
    const { app, shift, accounts, post } = await setup();
    expect(
      (await post(`/shifts/${shift.id}/decision`, { decision: 'QUERIED' }, accounts)).statusCode,
    ).toBe(400);
    const q = await post(
      `/shifts/${shift.id}/decision`,
      { decision: 'QUERIED', note: 'Check the LKR 100 shortage' },
      accounts,
    );
    expect(q.json().decision).toBe('QUERIED');
    await post(
      `/shifts/${shift.id}/decision`,
      { decision: 'APPROVED', note: 'Explained' },
      accounts,
    );
    expect((await app.inject({ url: '/approvals', headers: accounts })).json().rows).toHaveLength(
      0,
    );
    const all = (await app.inject({ url: '/approvals?status=ALL', headers: accounts })).json();
    expect(all.rows[0].approvals.map((a: { decision: string }) => a.decision)).toEqual([
      'QUERIED',
      'APPROVED',
    ]);
    expect(
      (await post(`/shifts/${shift.id}/decision`, { decision: 'APPROVED' }, accounts)).statusCode,
    ).toBe(409);
  });

  it('managers and cashiers cannot approve (segregation of duties)', async () => {
    const { shift, manager, cashier, post } = await setup();
    expect(
      (await post(`/shifts/${shift.id}/decision`, { decision: 'APPROVED' }, manager)).statusCode,
    ).toBe(403);
    expect(
      (await post(`/shifts/${shift.id}/decision`, { decision: 'APPROVED' }, cashier)).statusCode,
    ).toBe(403);
  });
});

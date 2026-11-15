import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, openTestShift, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  await openTestShift(store);
  const cashier = await authHeader(app, 'e1', '4826');
  const owner = await authHeader(app, 'e4', '6142');
  const post = (url: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...cashier, 'idempotency-key': randomUUID() },
      payload,
    });
  const sell = async (plate: string) => {
    const o = (
      await post('/orders', { plate, lines: [{ itemId: 'stopwash__small', qty: 1 }] })
    ).json();
    await post(`/orders/${o.id}/checkout`, { tenders: [{ method: 'CASH', amountCents: 75000 }] });
  };
  return { app, owner, cashier, sell };
}

describe('analytics API', () => {
  it('returns sales and retention for the week', async () => {
    const { app, owner, sell } = await setup();
    await sell('A-1');
    await sell('A-1');
    await sell('B-2');
    const r = (await app.inject({ url: '/analytics?period=WEEKLY', headers: owner })).json();
    expect(r.sales.current).toMatchObject({
      count: 3,
      revenueCents: 225000,
      avgTicketCents: 75000,
    });
    expect(r.retention).toMatchObject({ total: 2, new: 2, returning: 0 });
    const bad = await app.inject({
      url: '/analytics?period=CUSTOM&from=2026-11-10&to=2026-11-01',
      headers: owner,
    });
    expect(bad.statusCode).toBe(400);
  });

  it('builds the owner dashboard with a 7×24 heatmap', async () => {
    const { app, owner, sell } = await setup();
    await sell('A-1');
    const d = (await app.inject({ url: '/dashboard', headers: owner })).json();
    expect(d.today).toMatchObject({ count: 1, revenueCents: 75000 });
    expect(d.target).toEqual({ completed: 1, target: 15 });
    expect(d.heatmap.cents).toHaveLength(7);
    expect(d.heatmap.cents[0]).toHaveLength(24);
    expect(d.heatmap.cents.flat().reduce((a: number, b: number) => a + b, 0)).toBe(75000);
  });

  it('cashiers cannot see analytics', async () => {
    const { app, cashier } = await setup();
    expect((await app.inject({ url: '/dashboard', headers: cashier })).statusCode).toBe(403);
  });
});

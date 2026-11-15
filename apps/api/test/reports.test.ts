import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, openTestShift, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  await openTestShift(store);
  const cashier = await authHeader(app, 'e1', '4826');
  const manager = await authHeader(app, 'e2', '7391');
  const post = (url: string, payload: Record<string, unknown>, h = cashier) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  const sell = async (plate: string, tenders: Array<{ method: string; amountCents: number }>) => {
    const o = (
      await post('/orders', { plate, lines: [{ itemId: 'stopwash__small', qty: 1 }] })
    ).json();
    await post(`/orders/${o.id}/checkout`, { tenders });
    return o;
  };
  return { app, manager, post, sell };
}

describe('GET /reports/daily', () => {
  it('lists the day’s paid orders with cash, card and split totals net of refunds', async () => {
    const { app, manager, post, sell } = await setup();
    await sell('A-1', [{ method: 'CASH', amountCents: 75000 }]);
    await sell('B-2', [{ method: 'CARD', amountCents: 75000 }]);
    await sell('C-3', [
      { method: 'CASH', amountCents: 25000 },
      { method: 'CARD', amountCents: 50000 },
    ]);
    const refunded = await sell('D-4', [{ method: 'CASH', amountCents: 75000 }]);
    await post(`/orders/${refunded.id}/refund`, { reason: 'Unhappy' }, manager);
    await post('/orders', { plate: 'Q-9', lines: [{ itemId: 'stopwash__bike', qty: 1 }] }); // unpaid
    const r = (await app.inject({ url: '/reports/daily', headers: manager })).json();
    expect(r.rows.map((x: { plate: string; method: string }) => `${x.plate}:${x.method}`)).toEqual([
      'A-1:CASH',
      'B-2:CARD',
      'C-3:SPLIT',
    ]);
    expect(r.totals).toMatchObject({
      vehicles: 3,
      cashCents: 100000,
      cardCents: 125000,
      refundsCents: 75000,
      grandTotalCents: 225000,
    });
  });

  it('cashiers cannot read reports', async () => {
    const { app } = await setup();
    const h = await authHeader(app, 'e1', '4826');
    expect((await app.inject({ url: '/reports/daily', headers: h })).statusCode).toBe(403);
  });
});

describe('GET /reports/orders.csv', () => {
  it('exports completed orders with SWOMS columns and escaping', async () => {
    const { app, manager, sell, post } = await setup();
    await sell('A-1', [{ method: 'CASH', amountCents: 75000 }]);
    await post('/orders', { plate: 'Q-9', lines: [{ itemId: 'stopwash__bike', qty: 1 }] });
    const res = await app.inject({ url: '/reports/orders.csv', headers: manager });
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    const lines = res.body.slice(1).trim().split('\r\n');
    expect(lines[0]).toMatch(/^DATE,TIME IN,NUMBER PLATE/);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(',A-1,');
    expect(lines[1]).toContain(',750.00,750.00,0.00,CASH,');
  });
});

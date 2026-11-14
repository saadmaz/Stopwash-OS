import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const cashier = await authHeader(app, 'e1', '4826');
  const manager = await authHeader(app, 'e2', '7391');
  const create = async (plate: string, extra: Record<string, unknown> = {}) =>
    (
      await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { ...cashier, 'idempotency-key': randomUUID() },
        payload: { plate, lines: [{ itemId: 'stopwash__small', qty: 1 }], ...extra },
      })
    ).json();
  const status = (id: string, s: string, h = cashier, reason?: string) =>
    app.inject({
      method: 'POST',
      url: `/orders/${id}/status`,
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload: { status: s, reason },
    });
  return { app, store, cashier, manager, create, status };
}

describe('GET /orders (queue)', () => {
  it('lists today’s orders with ready ones first, paginated, with the daily target', async () => {
    const { app, cashier, create, status } = await setup();
    const a = await create('AAA-1');
    const b = await create('BBB-2');
    for (let i = 0; i < 10; i++) await create(`CC-${i}`);
    await status(b.id, 'READY');
    const res = await app.inject({ url: '/orders?pageSize=10', headers: cashier });
    const page = res.json();
    expect(page.total).toBe(12);
    expect(page.pageCount).toBe(2);
    expect(page.items[0].id).toBe(b.id);
    expect(page.items[1].id).toBe(a.id);
    expect(page.target).toEqual({ completed: 0, target: 15 });
  });

  it('searches by plate, name, phone and ticket', async () => {
    const { app, cashier, create } = await setup();
    await create('WP CAB-1234', { customerName: 'Nimal', customerPhone: '0771234567' });
    await create('KX-9');
    const find = async (q: string) =>
      (await app.inject({ url: `/orders?q=${encodeURIComponent(q)}`, headers: cashier })).json()
        .total;
    expect(await find('cab 12')).toBe(1);
    expect(await find('nim')).toBe(1);
    expect(await find('0771234')).toBe(1);
    expect(await find('#2')).toBe(1);
    expect(await find('zzz')).toBe(0);
  });
});

describe('POST /orders/:id/status', () => {
  it('moves an order through the floor flow and audits it', async () => {
    const { create, status, store } = await setup();
    const o = await create('AAA-1');
    expect((await status(o.id, 'IN_PROGRESS')).json().status).toBe('IN_PROGRESS');
    const ready = (await status(o.id, 'READY')).json();
    expect(ready.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      'QUEUED',
      'IN_PROGRESS',
      'READY',
    ]);
    const log = await store.audit.find({
      where: [
        { field: 'brandId', op: '==', value: 'stopwash' },
        { field: 'action', op: '==', value: 'order.status' },
      ],
    });
    expect(log).toHaveLength(2);
  });

  it('refuses invalid transitions and completing outside checkout', async () => {
    const { create, status } = await setup();
    const o = await create('AAA-1');
    const res = await status(o.id, 'COMPLETED');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ORDER_INVALID_TRANSITION');
  });

  it('only managers cancel, and only with a reason', async () => {
    const { create, status, manager } = await setup();
    const o = await create('AAA-1');
    expect((await status(o.id, 'CANCELLED', undefined, 'duplicate')).statusCode).toBe(403);
    expect((await status(o.id, 'CANCELLED', manager)).statusCode).toBe(400);
    const ok = await status(o.id, 'CANCELLED', manager, 'Customer left');
    expect(ok.json()).toMatchObject({ status: 'CANCELLED', cancelReason: 'Customer left' });
  });
});

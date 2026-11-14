import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const h = await authHeader(app, 'e1', '4826');
  const post = (payload: Record<string, unknown>, key: string = randomUUID()) =>
    app.inject({
      method: 'POST',
      url: '/orders',
      headers: { ...h, 'idempotency-key': key },
      payload,
    });
  return { app, store, post };
}

const wash = {
  plate: 'wp cab-1234',
  customerName: 'Nimal',
  customerPhone: '0771234567',
  lines: [
    { itemId: 'stopwash__medium', qty: 1 },
    { itemId: 'stopwash__wax', qty: 1 },
    { itemId: 'stopwash__air_freshener', qty: 2 },
  ],
};

describe('POST /orders', () => {
  it('creates a QUEUED order priced on the server', async () => {
    const { post, store } = await setup();
    const res = await post({ ...wash, totalCents: 1 }); // client total is ignored (not even accepted)
    expect(res.statusCode).toBe(201);
    const o = res.json();
    expect(o).toMatchObject({
      status: 'QUEUED',
      plateDisplay: 'WP CAB-1234',
      customerPhone: '+94771234567',
      subtotalCents: 225000,
      totalCents: 225000,
      ticket: 1,
      returning: false,
      locationId: 'katubedda',
      shiftId: null,
    });
    expect(o.lines.map((l: { code: string }) => l.code)).toEqual([
      'MEDIUM',
      'WAX',
      'AIR_FRESHENER',
    ]);
    const audit = await store.audit.find({
      where: [
        { field: 'brandId', op: '==', value: 'stopwash' },
        { field: 'action', op: '==', value: 'order.create' },
      ],
    });
    expect(audit).toHaveLength(1);
  });

  it('is idempotent: a retry with the same key returns the same order', async () => {
    const { post, store } = await setup();
    const key = randomUUID();
    const a = await post(wash, key);
    const b = await post(wash, key);
    expect(b.statusCode).toBe(200);
    expect(b.headers['idempotent-replay']).toBe('true');
    expect(b.json().id).toBe(a.json().id);
    expect(
      await store.orders.count({ where: [{ field: 'brandId', op: '==', value: 'stopwash' }] }),
    ).toBe(1);
    const reused = await post({ ...wash, plate: 'OTHER-1' }, key);
    expect(reused.statusCode).toBe(422);
  });

  it('numbers tickets per day and flags returning vehicles', async () => {
    const { post } = await setup();
    await post(wash);
    const second = await post({ ...wash, customerName: null, customerPhone: null });
    expect(second.json()).toMatchObject({ ticket: 2, returning: true, customerName: 'Nimal' });
  });

  it('allows product-only orders and rejects add-on-only ones', async () => {
    const { post } = await setup();
    expect(
      (await post({ plate: 'X1', lines: [{ itemId: 'stopwash__wiper_fluid', qty: 1 }] }))
        .statusCode,
    ).toBe(201);
    const bad = await post({ plate: 'X1', lines: [{ itemId: 'stopwash__wax', qty: 1 }] });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.details.pricing).toBe('NO_BILLABLE_ITEM');
  });

  it('requires an idempotency key and a role that may create orders', async () => {
    const { app } = await setup();
    const h = await authHeader(app, 'e1', '4826');
    expect(
      (await app.inject({ method: 'POST', url: '/orders', headers: h, payload: wash })).statusCode,
    ).toBe(400);
    const accounts = await authHeader(app, 'e3', '5038');
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { ...accounts, 'idempotency-key': randomUUID() },
      payload: wash,
    });
    expect(res.statusCode).toBe(403);
  });

  it('rolls back the visit if the order fails', async () => {
    const { post, store } = await setup();
    await post({
      plate: 'NEW-1',
      customerName: 'Ghost',
      lines: [{ itemId: 'stopwash__nope', qty: 1 }],
    });
    expect(
      await store.vehicles.count({ where: [{ field: 'brandId', op: '==', value: 'stopwash' }] }),
    ).toBe(0);
  });
});

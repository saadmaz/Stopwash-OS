import { describe, expect, it } from 'vitest';
import { authHeader, BRAND, LOCATION, seedBasics, T0, testApp } from './helpers';

describe('alerts API', () => {
  it('lists unacknowledged alerts per person and acks idempotently', async () => {
    const { app, store } = await testApp();
    await seedBasics(store);
    await store.alerts.insert({
      id: 'al-1',
      brandId: BRAND,
      locationId: LOCATION,
      createdAt: T0,
      createdBy: 'e1',
      kind: 'VARIANCE',
      severity: 'warning',
      message: 'Variance LKR 900.00',
      refType: 'shift',
      refId: 'shift-1',
      acknowledgedBy: [],
    });
    const manager = await authHeader(app, 'e2', '7391');
    const owner = await authHeader(app, 'e4', '6142');
    const list = (h: Record<string, string>) =>
      app.inject({ url: '/alerts', headers: h }).then((r) => r.json().items);
    expect(await list(manager)).toHaveLength(1);
    for (let i = 0; i < 2; i++) {
      const r = await app.inject({ method: 'POST', url: '/alerts/al-1/ack', headers: manager });
      expect(r.statusCode).toBe(200);
    }
    expect(await list(manager)).toHaveLength(0);
    expect(await list(owner)).toHaveLength(1);
    expect((await store.alerts.get('al-1'))?.acknowledgedBy).toEqual(['emp:e2']);
  });

  it('is not shown to cashiers', async () => {
    const { app, store } = await testApp();
    await seedBasics(store);
    const cashier = await authHeader(app, 'e1', '4826');
    expect((await app.inject({ url: '/alerts', headers: cashier })).statusCode).toBe(403);
  });
});

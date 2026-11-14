import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  await store.settings.update('stopwash__katubedda', {
    settings: {
      ...DEFAULT_SETTINGS,
      notificationNumbers: {
        stock: ['+94771111111'],
        equipment: ['+94772222222', '+94773333333'],
        variance: [],
      },
    },
  });
  const h = await authHeader(app, 'e1', '4826');
  const items = await store.checklistItems.find({
    where: [{ field: 'brandId', op: '==', value: 'stopwash' }],
    orderBy: { field: 'sort' },
  });
  const submit = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/checklists',
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  return { app, store, h, items, submit };
}

describe('POST /checklists', () => {
  it('records a clean pre-shift check with no alerts', async () => {
    const { submit, items } = await setup();
    const res = await submit({
      kind: 'PRE_SHIFT',
      entries: items.map((i) => ({ itemId: i.id, status: 'OK' })),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ alerts: [], whatsapp: [] });
    expect(res.json().checklist.stock).toHaveLength(5);
  });

  it('alerts on low stock and every faulty equipment item (old app missed mitts and power)', async () => {
    const { submit, items, app, h } = await setup();
    const fault = new Set(['Shampoo', 'Mitts & cloths', 'Power & water']);
    const res = await submit({
      kind: 'PRE_SHIFT',
      entries: items.map((i) => ({ itemId: i.id, status: fault.has(i.name.en) ? 'FAULT' : 'OK' })),
    });
    const body = res.json();
    expect(body.alerts.map((a: { kind: string }) => a.kind)).toEqual([
      'LOW_STOCK',
      'EQUIPMENT_FAULT',
    ]);
    expect(
      body.whatsapp.map((w: { kind: string; phone: string }) => `${w.kind}:${w.phone}`),
    ).toEqual(['stock:+94771111111', 'equipment:+94772222222', 'equipment:+94773333333']);
    const eq = decodeURIComponent(body.whatsapp[1].url.split('text=')[1]);
    expect(eq).toContain('EQUIPMENT FAILURE ALERT');
    expect(eq).toContain('❌ Mitts & cloths');
    expect(eq).toContain('❌ Power & water');
    const status = (await app.inject({ url: '/stock-status', headers: h })).json();
    expect(status).toMatchObject({ low: ['Shampoo'], faulty: ['Mitts & cloths', 'Power & water'] });
  });

  it('requires every item on a pre-shift check', async () => {
    const { submit, items } = await setup();
    const res = await submit({
      kind: 'PRE_SHIFT',
      entries: [{ itemId: items[0]!.id, status: 'OK' }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details.missing).toHaveLength(8);
  });

  it('a stock request needs at least one low item and says who asked', async () => {
    const { submit, items } = await setup();
    expect(
      (await submit({ kind: 'REQUEST', entries: [{ itemId: items[0]!.id, status: 'OK' }] }))
        .statusCode,
    ).toBe(400);
    const res = await submit({
      kind: 'REQUEST',
      entries: [{ itemId: items[1]!.id, status: 'FAULT' }],
    });
    const text = decodeURIComponent(res.json().whatsapp[0].url.split('text=')[1]);
    expect(text).toContain('STOCK REQUEST');
    expect(text).toContain('Requested by staff: Staff e1');
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, openTestShift, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  await openTestShift(store);
  const cashier = await authHeader(app, 'e1', '4826');
  const manager = await authHeader(app, 'e2', '7391');
  const send = (
    method: 'POST' | 'PATCH',
    url: string,
    payload: Record<string, unknown>,
    h = cashier,
  ) => app.inject({ method, url, headers: { ...h, 'idempotency-key': randomUUID() }, payload });
  const order = (
    await send('POST', '/orders', {
      plate: 'WP CAB-1234',
      lines: [{ itemId: 'stopwash__small', qty: 1 }],
    })
  ).json();
  return { app, store, cashier, manager, send, order };
}

const all = { where: [{ field: 'brandId' as const, op: '==' as const, value: 'stopwash' }] };

describe('PATCH /orders/:id', () => {
  it('fixes a wrong plate and adds an item, re-priced and audited with a reason', async () => {
    const { send, order, store } = await setup();
    const res = await send('PATCH', `/orders/${order.id}`, {
      plate: 'WP CAB-1243',
      lines: [
        { itemId: 'stopwash__small', qty: 1 },
        { itemId: 'stopwash__wax', qty: 1 },
      ],
      reason: 'Typo in plate, customer added wax',
    });
    expect(res.json()).toMatchObject({ plateDisplay: 'WP CAB-1243', totalCents: 100000 });
    const log = (await store.audit.find(all)).find((a) => a.action === 'order.update');
    expect(log?.reason).toBe('Typo in plate, customer added wax');
    expect((log?.before as { plateDisplay: string }).plateDisplay).toBe('WP CAB-1234');
  });

  it('requires a reason and refuses paid orders', async () => {
    const { send, order } = await setup();
    expect((await send('PATCH', `/orders/${order.id}`, { plate: 'X' })).statusCode).toBe(400);
    await send('POST', `/orders/${order.id}/checkout`, {
      tenders: [{ method: 'CASH', amountCents: 75000 }],
    });
    const res = await send('PATCH', `/orders/${order.id}`, { plate: 'X', reason: 'late change' });
    expect(res.json().error.code).toBe('ORDER_NOT_EDITABLE');
  });
});

describe('POST /orders/:id/refund', () => {
  it('appends reversing payments (never edits) and voids the sale', async () => {
    const { send, order, store, manager } = await setup();
    await send('POST', `/orders/${order.id}/checkout`, {
      tenders: [
        { method: 'CASH', amountCents: 50000 },
        { method: 'CARD', amountCents: 25000 },
      ],
    });
    const res = await send(
      'POST',
      `/orders/${order.id}/refund`,
      { reason: 'Customer unhappy' },
      manager,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().order).toMatchObject({
      status: 'CANCELLED',
      paidCents: 0,
      cancelReason: 'Customer unhappy',
    });
    const payments = await store.payments.find(all);
    expect(payments.map((p) => p.amountCents).sort((a, b) => a - b)).toEqual([
      -50000, -25000, 25000, 50000,
    ]);
    expect(payments.reduce((s, p) => s + p.amountCents, 0)).toBe(0);
    expect((await store.vehicles.get('stopwash__WPCAB1234'))?.completedVisits).toBe(0);
    const again = await send('POST', `/orders/${order.id}/refund`, { reason: 'twice' }, manager);
    expect(again.statusCode).toBe(409);
  });

  it('is manager-only', async () => {
    const { send, order } = await setup();
    await send('POST', `/orders/${order.id}/checkout`, {
      tenders: [{ method: 'CASH', amountCents: 75000 }],
    });
    expect((await send('POST', `/orders/${order.id}/refund`, { reason: 'x' })).statusCode).toBe(
      403,
    );
  });
});

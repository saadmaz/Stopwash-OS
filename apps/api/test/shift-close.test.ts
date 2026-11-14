import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

/** Float LKR 10,000; one LKR 750 cash wash; one LKR 1,000 card wash; LKR 200 expense → expected 10,550. */
async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  await store.settings.update('stopwash__katubedda', {
    settings: {
      ...DEFAULT_SETTINGS,
      notificationNumbers: { stock: [], equipment: [], variance: ['+94779999999'] },
    },
  });
  const cashier = await authHeader(app, 'e1', '4826');
  const post = (url: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...cashier, 'idempotency-key': randomUUID() },
      payload,
    });
  const shift = (
    await post('/shifts', {
      supervisorEmployeeId: 'e2',
      openingCount: { notes: { '100000': 10 }, coinsCents: 0 },
    })
  ).json();
  const sell = async (itemId: string, method: string, amountCents: number) => {
    const o = (
      await post('/orders', { plate: `P-${randomUUID().slice(0, 4)}`, lines: [{ itemId, qty: 1 }] })
    ).json();
    await post(`/orders/${o.id}/checkout`, { tenders: [{ method, amountCents }] });
  };
  await sell('stopwash__small', 'CASH', 75000);
  await sell('stopwash__medium', 'CARD', 100000);
  await post('/cash-movements', {
    type: 'EXPENSE',
    categoryId: 'stopwash__e004',
    amountCents: 20000,
    paidTo: 'Canteen',
  });
  // counted note mix helper: n × LKR 1,000 + coins
  const count = (thousands: number, coinsCents = 0) => ({
    notes: { '100000': thousands },
    coinsCents,
  });
  const close = (body: Record<string, unknown>) =>
    post(`/shifts/${shift.id}/close`, { handover: { employeeId: 'e2', pin: '7391' }, ...body });
  return { app, store, cashier, shift, close, count };
}

describe('shift summary and close', () => {
  it('shows system totals before the count', async () => {
    const { app, cashier, shift } = await setup();
    const s = (await app.inject({ url: `/shifts/${shift.id}/summary`, headers: cashier })).json();
    expect(s.reconciliation).toMatchObject({
      cashSalesCents: 75000,
      cardSalesCents: 100000,
      expensesCents: 20000,
      expectedCents: 1055000,
    });
    expect(s.vehicleCount).toBe(2);
  });

  it('closes a matched drawer, records the handover and frees the location', async () => {
    const { close, count, store } = await setup();
    const res = await close({ closingCount: count(10, 55000) });
    expect(res.statusCode).toBe(200);
    expect(res.json().close).toMatchObject({
      varianceCents: 0,
      countedCents: 1055000,
      handoverName: 'Staff e2',
      vehicleCount: 2,
    });
    expect(res.json().reconciliation.label).toBe('MATCHED');
    expect((await store.locations.get('katubedda'))?.openShiftId).toBeNull();
    const again = await close({ closingCount: count(10, 55000) });
    expect(again.json().error.code).toBe('SHIFT_NOT_CLOSABLE');
  });

  it('needs an explanation above LKR 500 and sends a variance alert link', async () => {
    const { close, count } = await setup();
    const short = { closingCount: count(10, 0) }; // LKR 550 short
    expect((await close(short)).json().error.code).toBe('VARIANCE_EXPLANATION_REQUIRED');
    const res = await close({ ...short, notes: 'Gave change twice' });
    expect(res.json().reconciliation).toMatchObject({ varianceCents: -55000, label: 'SHORTAGE' });
    expect(res.json().whatsapp[0].phone).toBe('+94779999999');
  });

  it('needs a manager override above LKR 2,000', async () => {
    const { close, count } = await setup();
    const big = { closingCount: count(8, 0), notes: 'Unknown' }; // LKR 2,550 short
    expect((await close(big)).json().error.code).toBe('OVERRIDE_REQUIRED');
    const ok = await close({ ...big, override: { employeeId: 'e2', pin: '7391' } });
    expect(ok.json().close.overrideByEmployeeId).toBe('e2');
  });

  it('handover must be someone else, with their own PIN', async () => {
    const { close, count } = await setup();
    const self = await close({
      closingCount: count(10, 55000),
      handover: { employeeId: 'e1', pin: '4826' },
    });
    expect(self.json().error.code).toBe('HANDOVER_REQUIRED');
    const wrong = await close({
      closingCount: count(10, 55000),
      handover: { employeeId: 'e2', pin: '1112' },
    });
    expect(wrong.json().error.code).toBe('OVERRIDE_INVALID');
  });
});

describe('GET /shifts/:id/report', () => {
  it('bundles the close record and cash entries for the PDF', async () => {
    const { app, cashier, shift, close, count } = await setup();
    await close({ closingCount: count(10, 55000) });
    const r = (await app.inject({ url: `/shifts/${shift.id}/report`, headers: cashier })).json();
    expect(r.closes).toHaveLength(1);
    expect(r.cashMovements[0]).toMatchObject({ categoryCode: 'E004', amountCents: 20000 });
    expect(r.business.name).toBe('STOPWASH (PVT) LTD');
    expect(r.shift.status).toBe('CLOSED');
  });
});

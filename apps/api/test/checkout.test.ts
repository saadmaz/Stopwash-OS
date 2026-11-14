import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { describe, expect, it } from 'vitest';
import { receiptNumber } from '../src/services/checkout';
import { authHeader, openTestShift, seedBasics, testApp } from './helpers';

async function setup({ shift = true } = {}) {
  const { app, store } = await testApp();
  await seedBasics(store);
  if (shift) await openTestShift(store);
  const h = await authHeader(app, 'e1', '4826');
  const post = (url: string, payload: Record<string, unknown>, key = randomUUID()) =>
    app.inject({ method: 'POST', url, headers: { ...h, 'idempotency-key': key }, payload });
  const order = async (plate = 'WP CAB-1234') =>
    (
      await post('/orders', {
        plate,
        lines: [
          { itemId: 'stopwash__small', qty: 1 },
          { itemId: 'stopwash__wax', qty: 1 },
        ],
      })
    ).json(); // 750 + 250 = 1,000.00
  return { app, store, post, order };
}

describe('receiptNumber', () => {
  it('uses the SWOMS DDMM + sequence format', () => {
    expect(receiptNumber('2026-11-15', 7)).toBe('1511007');
  });
});

describe('POST /orders/:id/checkout', () => {
  it('takes a split payment, numbers the receipt and appends payments', async () => {
    const { post, order, store } = await setup();
    const o = await order();
    const res = await post(`/orders/${o.id}/checkout`, {
      tenders: [
        { method: 'CASH', amountCents: 60000 },
        { method: 'CARD', amountCents: 40000 },
      ],
    });
    expect(res.statusCode).toBe(200);
    const { order: done, payments } = res.json();
    expect(done).toMatchObject({ status: 'COMPLETED', paidCents: 100000, shiftId: 'shift-1' });
    expect(done.number).toMatch(/^\d{4}001$/);
    expect(
      payments.map((p: { method: string; amountCents: number }) => [p.method, p.amountCents]),
    ).toEqual([
      ['CASH', 60000],
      ['CARD', 40000],
    ]);
    const v = await store.vehicles.get('stopwash__WPCAB1234');
    expect(v).toMatchObject({ completedVisits: 1, totalSpentCents: 100000 });
  });

  it('refuses payments that do not add up, and charges nothing', async () => {
    const { post, order, store } = await setup();
    const o = await order();
    const res = await post(`/orders/${o.id}/checkout`, {
      tenders: [{ method: 'CASH', amountCents: 99999 }],
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatchObject({
      code: 'TENDER_MISMATCH',
      details: { totalCents: 100000 },
    });
    expect(
      await store.payments.count({ where: [{ field: 'brandId', op: '==', value: 'stopwash' }] }),
    ).toBe(0);
  });

  it('needs an open shift', async () => {
    const { post, order } = await setup({ shift: false });
    const o = await order();
    const res = await post(`/orders/${o.id}/checkout`, {
      tenders: [{ method: 'CASH', amountCents: 100000 }],
    });
    expect(res.json().error.code).toBe('SHIFT_NOT_OPEN');
  });

  it('applies a small discount with a reason; a large one needs a manager PIN', async () => {
    const { post, order } = await setup();
    const a = await order('A-1');
    const noReason = await post(`/orders/${a.id}/checkout`, {
      discountCents: 10000,
      tenders: [{ method: 'CASH', amountCents: 90000 }],
    });
    expect(noReason.statusCode).toBe(400);
    const ok = await post(`/orders/${a.id}/checkout`, {
      discountCents: 10000,
      discountReason: 'Regular',
      tenders: [{ method: 'CASH', amountCents: 90000 }],
    });
    expect(ok.json().order).toMatchObject({ discountCents: 10000, totalCents: 90000 });

    const b = await order('B-2');
    const big = {
      discountCents: 50000,
      discountReason: 'Complaint',
      tenders: [{ method: 'CASH', amountCents: 50000 }],
    };
    expect((await post(`/orders/${b.id}/checkout`, big)).json().error.code).toBe(
      'OVERRIDE_REQUIRED',
    );
    expect(
      (
        await post(`/orders/${b.id}/checkout`, {
          ...big,
          override: { employeeId: 'e2', pin: '1112' },
        })
      ).json().error.code,
    ).toBe('OVERRIDE_INVALID');
    const approved = await post(`/orders/${b.id}/checkout`, {
      ...big,
      override: { employeeId: 'e2', pin: '7391' },
    });
    expect(approved.json().order.totalCents).toBe(50000);
  });

  it('is idempotent and cannot be paid twice', async () => {
    const { post, order, store } = await setup();
    const o = await order();
    const key = randomUUID();
    const body = { tenders: [{ method: 'CARD', amountCents: 100000 }] };
    const first = await post(`/orders/${o.id}/checkout`, body, key);
    const retry = await post(`/orders/${o.id}/checkout`, body, key);
    expect(retry.json().order.number).toBe(first.json().order.number);
    expect(
      await store.payments.count({ where: [{ field: 'brandId', op: '==', value: 'stopwash' }] }),
    ).toBe(1);
    const again = await post(`/orders/${o.id}/checkout`, body);
    expect(again.json().error.code).toBe('ORDER_NOT_EDITABLE');
  });

  it('gives the loyalty reward on the Nth visit', async () => {
    const { post, order, store } = await setup();
    await store.settings.update('stopwash__katubedda', {
      settings: { ...DEFAULT_SETTINGS, loyalty: { enabled: true, everyNth: 2, rewardPct: 50 } },
    });
    const pay = async (total: number) => {
      const o = await order();
      return (
        await post(`/orders/${o.id}/checkout`, {
          tenders: total ? [{ method: 'CASH', amountCents: total }] : [],
        })
      ).json();
    };
    expect((await pay(100000)).order.loyaltyDiscountCents).toBe(0); // 1st
    const second = await pay(62500); // 2nd visit: half of the 750 wash off
    expect(second.order).toMatchObject({ loyaltyDiscountCents: 37500, totalCents: 62500 });
  });
});

describe('GET /orders/:id/quote', () => {
  it('returns the exact amount to collect and whether approval is needed', async () => {
    const { app, order } = await setup();
    const o = await order();
    const h = await authHeader(app, 'e1', '4826');
    const q = await app.inject({ url: `/orders/${o.id}/quote?discountCents=50000`, headers: h });
    expect(q.json()).toMatchObject({
      subtotalCents: 100000,
      discountCents: 50000,
      totalCents: 50000,
      discountNeedsApproval: true,
    });
    const single = await app.inject({ url: `/orders/${o.id}`, headers: h });
    expect(single.json().id).toBe(o.id);
  });
});

describe('GET /orders/:id/receipt', () => {
  it('returns order, payments and business details once paid', async () => {
    const { app, post, order } = await setup();
    const o = await order();
    const h = await authHeader(app, 'e1', '4826');
    expect((await app.inject({ url: `/orders/${o.id}/receipt`, headers: h })).statusCode).toBe(409);
    await post(`/orders/${o.id}/checkout`, { tenders: [{ method: 'CASH', amountCents: 100000 }] });
    const r = (await app.inject({ url: `/orders/${o.id}/receipt`, headers: h })).json();
    expect(r.payments).toHaveLength(1);
    expect(r.business.name).toBe('STOPWASH (PVT) LTD');
    expect(r.order.number).toMatch(/^\d{7}$/);
  });
});

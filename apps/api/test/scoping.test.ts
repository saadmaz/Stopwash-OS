import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, openTestShift, seedBasics, testApp } from './helpers';

/** Records at a location the caller is not assigned to must stay invisible and untouchable. */
describe('location scoping', () => {
  it('hides another location’s cash movements by shift id', async () => {
    const { app, store } = await testApp();
    await seedBasics(store);
    const shiftId = await openTestShift(store, 'shift-x');
    await store.shifts.update(shiftId, { locationId: 'colombo' });
    const cashier = await authHeader(app, 'e1', '4826');
    const res = await app.inject({ url: `/cash-movements?shiftId=${shiftId}`, headers: cashier });
    expect(res.statusCode).toBe(403);
    const missing = await app.inject({ url: '/cash-movements?shiftId=nope', headers: cashier });
    expect(missing.statusCode).toBe(404);
  });

  it('hides and protects another location’s invoices', async () => {
    const { app, store } = await testApp();
    await seedBasics(store);
    const accounts = await authHeader(app, 'e3', '5038');
    const created = await app.inject({
      method: 'POST',
      url: '/invoices',
      headers: { ...accounts, 'idempotency-key': randomUUID() },
      payload: {
        customer: { name: 'Fleet Co' },
        date: '2026-11-15',
        lines: [{ description: 'Wash', qty: 1, unitPriceCents: 100000 }],
      },
    });
    const original = (await store.invoices.get(created.json().id as string))!;
    const id = 'inv-colombo';
    await store.invoices.insert({ ...original, id, locationId: 'colombo' });
    const list = await app.inject({ url: '/invoices', headers: accounts });
    expect(list.json().items.map((i: { id: string }) => i.id)).toEqual([original.id]);
    const settle = await app.inject({
      method: 'POST',
      url: `/invoices/${id}/settle`,
      headers: { ...accounts, 'idempotency-key': randomUUID() },
      payload: { amountCents: 100000, method: 'CASH' },
    });
    expect(settle.statusCode).toBe(403);
  });
});

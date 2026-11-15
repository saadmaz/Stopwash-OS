import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const accounts = await authHeader(app, 'e3', '5038');
  const cashier = await authHeader(app, 'e1', '4826');
  const post = (url: string, payload: Record<string, unknown>, h = accounts) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  return { app, store, accounts, cashier, post };
}

const fleet = {
  customer: { name: 'Lanka Fleet (Pvt) Ltd', address: 'Colombo 03' },
  date: '2026-11-15',
  lines: [
    { description: 'Van wash', qty: 10, unitPriceCents: 125000 },
    { description: 'Interior vacuum', qty: 10, unitPriceCents: 50000 },
  ],
  discountCents: 100000,
};

describe('custom invoices', () => {
  it('numbers from 55100, computes totals and remembers the customer', async () => {
    const { post, app, accounts } = await setup();
    const a = (await post('/invoices', fleet)).json();
    const b = (await post('/invoices', { ...fleet, paid: { method: 'BANK_TRANSFER' } })).json();
    expect([a.number, b.number]).toEqual(['55100', '55101']);
    expect(a).toMatchObject({ subtotalCents: 1750000, totalCents: 1650000 });
    const list = (await app.inject({ url: '/invoices', headers: accounts })).json().items;
    expect(list.map((i: { status: string }) => i.status).sort()).toEqual(['PAID', 'UNPAID']);
    const customers = (await app.inject({ url: '/billing-customers', headers: accounts })).json()
      .items;
    expect(customers).toHaveLength(1);
  });

  it('records part payments and voids without deleting', async () => {
    const { post, app, accounts, store } = await setup();
    const inv = (await post('/invoices', fleet)).json();
    await post(`/invoices/${inv.id}/settle`, { amountCents: 650000, method: 'CASH' });
    let list = (await app.inject({ url: '/invoices', headers: accounts })).json().items;
    expect(list[0]).toMatchObject({ status: 'PARTIAL', paidCents: 650000 });
    await post(`/invoices/${inv.id}/void`, { reason: 'Wrong customer' });
    list = (await app.inject({ url: '/invoices', headers: accounts })).json().items;
    expect(list[0].status).toBe('VOID');
    expect(
      await store.invoices.count({ where: [{ field: 'brandId', op: '==', value: 'stopwash' }] }),
    ).toBe(2);
    expect((await post(`/invoices/${inv.id}/void`, { reason: 'again' })).statusCode).toBe(409);
  });

  it('cashiers cannot issue invoices', async () => {
    const { post, cashier } = await setup();
    expect((await post('/invoices', fleet, cashier)).statusCode).toBe(403);
  });
});

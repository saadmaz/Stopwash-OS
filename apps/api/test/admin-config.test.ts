import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const manager = await authHeader(app, 'e2', '7391');
  const owner = await authHeader(app, 'e4', '6142');
  const cashier = await authHeader(app, 'e1', '4826');
  return { app, store, manager, owner, cashier };
}

const ceramic = {
  kind: 'addon',
  code: 'CERAMIC',
  name: { en: 'Ceramic coat' },
  priceCents: 150000,
  maxQty: 1,
  locationIds: null,
  icon: null,
  sort: 9,
  active: true,
};

describe('catalog admin', () => {
  it('manager adds and reprices an item; both are audited', async () => {
    const { app, store, manager } = await setup();
    const created = await app.inject({
      method: 'POST',
      url: '/catalog',
      headers: manager,
      payload: ceramic,
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    const patched = await app.inject({
      method: 'PATCH',
      url: `/catalog/${id}`,
      headers: manager,
      payload: { priceCents: 175000 },
    });
    expect(patched.json().priceCents).toBe(175000);
    const log = await store.audit.find({
      where: [
        { field: 'brandId', op: '==', value: 'stopwash' },
        { field: 'entityId', op: '==', value: id },
      ],
    });
    expect(log.map((l) => l.action).sort()).toEqual(['catalogItem.create', 'catalogItem.update']);
  });

  it('cashiers cannot change prices', async () => {
    const { app, cashier } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/catalog',
      headers: cashier,
      payload: ceramic,
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects duplicate codes, float prices and code changes', async () => {
    const { app, manager } = await setup();
    const dup = await app.inject({
      method: 'POST',
      url: '/catalog',
      headers: manager,
      payload: { ...ceramic, code: 'WAX' },
    });
    expect(dup.statusCode).toBe(409);
    const float = await app.inject({
      method: 'POST',
      url: '/catalog',
      headers: manager,
      payload: { ...ceramic, priceCents: 10.5 },
    });
    expect(float.statusCode).toBe(400);
    const rename = await app.inject({
      method: 'PATCH',
      url: '/catalog/stopwash__wax',
      headers: manager,
      payload: { code: 'WAXX' },
    });
    expect(rename.statusCode).toBe(400);
  });
});

describe('settings admin', () => {
  it('manager changes the daily target and thresholds', async () => {
    const { app, manager } = await setup();
    const res = await app.inject({
      method: 'PUT',
      url: '/settings',
      headers: manager,
      payload: {
        ...DEFAULT_SETTINGS,
        dailyVehicleTarget: 20,
        notificationNumbers: { stock: ['+94771234567'], equipment: [], variance: [] },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().dailyVehicleTarget).toBe(20);
  });

  it('only the owner may change tax or payroll settings', async () => {
    const { app, manager, owner } = await setup();
    const payload = { ...DEFAULT_SETTINGS, tax: { ...DEFAULT_SETTINGS.tax, enabled: true } };
    expect(
      (await app.inject({ method: 'PUT', url: '/settings', headers: manager, payload })).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'PUT', url: '/settings', headers: owner, payload })).statusCode,
    ).toBe(200);
  });

  it('validates thresholds', async () => {
    const { app, manager } = await setup();
    const res = await app.inject({
      method: 'PUT',
      url: '/settings',
      headers: manager,
      payload: {
        ...DEFAULT_SETTINGS,
        variance: { explainAboveCents: 500000, overrideAboveCents: 1000 },
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('cash categories', () => {
  it('adds a new expense category with an E-code', async () => {
    const { app, manager } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/cash-categories',
      headers: manager,
      payload: {
        type: 'EXPENSE',
        code: 'E008',
        name: { en: 'Generator fuel' },
        sort: 8,
        active: true,
      },
    });
    expect(res.statusCode).toBe(201);
  });
});

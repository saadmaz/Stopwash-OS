import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Ctx } from '../src/lib/context';
import { createMemoryStore } from '../src/repos';
import { lookup, recordVisit } from '../src/services/customers';
import { authHeader, openTestShift, seedBasics, testApp } from './helpers';

const ctx = (at = '2026-11-15T04:00:00Z'): Ctx => ({
  actor: {
    id: 'u1',
    name: 'Kasun',
    role: 'cashier',
    brandId: 'stopwash',
    locationIds: ['katubedda'],
    employeeId: 'e1',
    deviceId: null,
  },
  requestId: null,
  now: new Date(at),
});

describe('recordVisit', () => {
  it('creates vehicle and customer on the first visit, then marks returning', async () => {
    const db = createMemoryStore();
    const first = await recordVisit(db, ctx(), {
      plate: 'wp cab-1234',
      customerName: 'Nimal',
      customerPhone: '0771234567',
      vehicleClassCode: 'SMALL',
    });
    expect(first.returning).toBe(false);
    expect(first.vehicle).toMatchObject({
      plateKey: 'WPCAB1234',
      plateDisplay: 'WP CAB-1234',
      visitCount: 1,
    });
    expect(first.customer).toMatchObject({ name: 'Nimal', phone: '+94771234567' });

    const again = await recordVisit(db, ctx('2026-11-16T04:00:00Z'), {
      plate: 'WP CAB 1234',
      customerName: null,
      customerPhone: null,
      vehicleClassCode: null,
    });
    expect(again.returning).toBe(true);
    expect(again.vehicle.visitCount).toBe(2);
    expect(again.vehicle.vehicleClassCode).toBe('SMALL');
    expect(again.customer?.id).toBe(first.customer?.id); // remembered via the vehicle
    expect(again.customer?.name).toBe('Nimal');
  });

  it('links a second vehicle to the same customer by phone', async () => {
    const db = createMemoryStore();
    const a = await recordVisit(db, ctx(), {
      plate: 'CAB-1',
      customerName: 'Nimal',
      customerPhone: '+94 77 123 4567',
      vehicleClassCode: null,
    });
    const b = await recordVisit(db, ctx(), {
      plate: 'KX-2',
      customerName: null,
      customerPhone: '0771234567',
      vehicleClassCode: null,
    });
    expect(b.customer?.id).toBe(a.customer?.id);
    expect(b.customer?.plateKeys).toEqual(['CAB1', 'KX2']);
    expect(b.returning).toBe(false); // the plate is new
  });

  it('keeps anonymous walk-ins without a customer record', async () => {
    const db = createMemoryStore();
    const r = await recordVisit(db, ctx(), {
      plate: 'BIKE-9',
      customerName: null,
      customerPhone: null,
      vehicleClassCode: 'BIKE',
    });
    expect(r.customer).toBeNull();
  });
});

describe('lookup', () => {
  it('finds by plate, phone and name prefix', async () => {
    const db = createMemoryStore();
    await recordVisit(db, ctx(), {
      plate: 'WP CAB-1234',
      customerName: 'Nimal Perera',
      customerPhone: '0771234567',
      vehicleClassCode: 'SMALL',
    });
    expect((await lookup(db, 'stopwash', { plate: 'cab' })).vehicles).toHaveLength(0); // prefix, not substring
    const byPlate = await lookup(db, 'stopwash', { plate: 'wp ca' });
    expect(byPlate.vehicles[0]?.customer).toMatchObject({
      name: 'Nimal Perera',
      phone: '+94771234567',
    });
    expect((await lookup(db, 'stopwash', { phone: '0771' })).customers).toHaveLength(1);
    expect((await lookup(db, 'stopwash', { phone: '77123' })).customers).toHaveLength(1);
    expect((await lookup(db, 'stopwash', { name: 'nim' })).customers[0]?.name).toBe('Nimal Perera');
    expect((await lookup(db, 'otherbrand', { name: 'nim' })).customers).toHaveLength(0);
  });
});

describe('customer routes', () => {
  it('serves lookups to the counter and 404s unknown plates', async () => {
    const { app, store } = await testApp();
    await seedBasics(store);
    await recordVisit(store, ctx(), {
      plate: 'WP CAB-1234',
      customerName: 'Nimal',
      customerPhone: null,
      vehicleClassCode: 'SMALL',
    });
    const h = await authHeader(app, 'e1', '4826');
    const res = await app.inject({ url: '/lookup?plate=WPC', headers: h });
    expect(res.json().vehicles[0].plateDisplay).toBe('WP CAB-1234');
    const hist = await app.inject({ url: '/vehicles/wp%20cab-1234', headers: h });
    expect(hist.statusCode).toBe(200);
    expect(hist.json().orders).toEqual([]);
    expect((await app.inject({ url: '/vehicles/NOPE1', headers: h })).statusCode).toBe(404);
  });
});

describe('vehicle history', () => {
  it('lists the plate’s orders newest first, brand-scoped', async () => {
    const { app, store } = await testApp();
    await seedBasics(store);
    await openTestShift(store);
    const h = await authHeader(app, 'e1', '4826');
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: 'POST',
        url: '/orders',
        headers: { ...h, 'idempotency-key': randomUUID() },
        payload: { plate: 'CAB-1234', lines: [{ itemId: 'stopwash__small', qty: 1 }] },
      });
    }
    const res = (await app.inject({ url: '/vehicles/cab1234', headers: h })).json();
    expect(res.vehicle.visitCount).toBe(2);
    expect(res.orders).toHaveLength(2);
    expect(res.orders[0].ticket).toBeGreaterThan(res.orders[1].ticket);
  });
});

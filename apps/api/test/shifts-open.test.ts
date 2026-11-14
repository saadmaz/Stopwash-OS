import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const h = await authHeader(app, 'e1', '4826');
  const open = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/shifts',
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  return { app, store, h, open };
}

const count = { notes: { '500000': 2, '100000': 3 }, coinsCents: 5000 }; // 13,050.00

describe('POST /shifts', () => {
  it('opens a shift with the counted float and links it to the location', async () => {
    const { open, app, h, store } = await setup();
    const res = await open({
      supervisorEmployeeId: 'e2',
      openingCount: count,
      carryoverNotes: 'Float from safe',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      status: 'OPEN',
      openingCents: 1305000,
      supervisorName: 'Staff e2',
    });
    expect(res.json().businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const current = (await app.inject({ url: '/shifts/current', headers: h })).json();
    expect(current.shift.id).toBe(res.json().id);
    expect((await store.locations.get('katubedda'))?.openShiftId).toBe(res.json().id);
  });

  it('allows only one open shift per location', async () => {
    const { open } = await setup();
    await open({ supervisorEmployeeId: 'e2', openingCount: count });
    const again = await open({ supervisorEmployeeId: 'e2', openingCount: count });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('SHIFT_ALREADY_OPEN');
  });

  it('requires a supervisor who can open shifts and a valid count', async () => {
    const { open } = await setup();
    expect((await open({ supervisorEmployeeId: 'e1', openingCount: count })).statusCode).toBe(400); // washer role, not allowed
    const bad = await open({
      supervisorEmployeeId: 'e2',
      openingCount: { notes: { '700': 1 }, coinsCents: 0 },
    });
    expect(bad.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('reports no shift when none is open', async () => {
    const { app, h } = await setup();
    expect((await app.inject({ url: '/shifts/current', headers: h })).json()).toEqual({
      shift: null,
    });
  });
});

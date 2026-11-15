import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, DEVICE, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const manager = await authHeader(app, 'e2', '7391');
  const owner = await authHeader(app, 'e4', '6142');
  const cashier = await authHeader(app, 'e1', '4826');
  const send = (
    method: 'POST' | 'PATCH',
    url: string,
    payload: Record<string, unknown>,
    h = manager,
  ) => app.inject({ method, url, headers: { ...h, 'idempotency-key': randomUUID() }, payload });
  return { app, store, manager, owner, cashier, send };
}

const newHire = {
  code: 'SW010',
  name: 'Amal Silva',
  phone: '0771112222',
  jobTitle: 'Washer',
  systemRole: 'cashier',
  locationIds: ['katubedda'],
  baseSalaryCents: 4_000_000,
  recurringDeductionCents: 0,
  recurringAdditionCents: 250_000,
  incentiveRuleId: null,
  canOpenShift: false,
  pin: '3579',
};

describe('employees API', () => {
  it('manager adds an employee who can then sign in with their PIN', async () => {
    const { send, app } = await setup();
    const res = await send('POST', '/employees', newHire);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ code: 'SW010', hasPin: true, active: true });
    expect(res.json()).not.toHaveProperty('pin');
    const login = await app.inject({
      method: 'POST',
      url: '/auth/pin',
      payload: { ...DEVICE, employeeId: res.json().id, pin: '3579' },
    });
    expect(login.statusCode).toBe(200);
  });

  it('rejects duplicate codes, weak PINs and cashier writes', async () => {
    const { send, cashier } = await setup();
    await send('POST', '/employees', newHire);
    expect((await send('POST', '/employees', { ...newHire, name: 'Other' })).statusCode).toBe(409);
    expect(
      (await send('POST', '/employees', { ...newHire, code: 'SW011', pin: '1234' })).statusCode,
    ).toBe(400);
    expect(
      (await send('POST', '/employees', { ...newHire, code: 'SW012' }, cashier)).statusCode,
    ).toBe(403);
  });

  it('only the owner can grant manager access', async () => {
    const { send, owner } = await setup();
    const asManager = await send('POST', '/employees', { ...newHire, systemRole: 'manager' });
    expect(asManager.statusCode).toBe(403);
    expect(
      (await send('POST', '/employees', { ...newHire, systemRole: 'manager' }, owner)).statusCode,
    ).toBe(201);
  });

  it('deactivates instead of deleting; inactive staff disappear from lists and sign-in', async () => {
    const { send, app, manager } = await setup();
    const e = (await send('POST', '/employees', newHire)).json();
    await send('PATCH', `/employees/${e.id}`, { active: false });
    const list = (await app.inject({ url: '/employees', headers: manager })).json().items;
    expect(list.find((x: { id: string }) => x.id === e.id)).toBeUndefined();
    const all = (
      await app.inject({ url: '/employees?includeInactive=true', headers: manager })
    ).json().items;
    expect(all.find((x: { id: string }) => x.id === e.id).active).toBe(false);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/pin',
      payload: { ...DEVICE, employeeId: e.id, pin: '3579' },
    });
    expect(login.statusCode).toBe(401);
  });

  it('resets a PIN and toggles skip-recurring for a period', async () => {
    const { send, app } = await setup();
    const e = (await send('POST', '/employees', { ...newHire, pin: null })).json();
    expect(e.hasPin).toBe(false);
    expect((await send('POST', `/employees/${e.id}/pin`, { pin: '8642' })).statusCode).toBe(200);
    const login = await app.inject({
      method: 'POST',
      url: '/auth/pin',
      payload: { ...DEVICE, employeeId: e.id, pin: '8642' },
    });
    expect(login.statusCode).toBe(200);
    const ex = await send('POST', `/employees/${e.id}/exempt`, { period: '2026-11', exempt: true });
    expect(ex.json().exemptMonths).toEqual(['2026-11']);
  });
});

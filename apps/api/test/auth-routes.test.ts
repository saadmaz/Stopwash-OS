import { describe, expect, it } from 'vitest';
import { DevJwtIssuer } from '../src/services/tokens';
import { DEVICE, seedBasics, TEST_SECRET, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  return { app, store };
}

describe('POST /auth/device/staff', () => {
  it('lists staff with POS access for the device location', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'POST', url: '/auth/device/staff', payload: DEVICE });
    expect(res.statusCode).toBe(200);
    const ids = res.json().staff.map((s: { id: string }) => s.id);
    expect(ids).toEqual(['e1', 'e2', 'e3', 'e4']); // e5 has no system role
    expect(res.json().staff[0]).not.toHaveProperty('pinHash');
  });

  it('rejects an unknown device or wrong secret', async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/device/staff',
      payload: { ...DEVICE, deviceSecret: 'wrong-secret-0123456789' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('DEVICE_INVALID');
  });
});

describe('POST /auth/pin', () => {
  it('signs in and returns a token carrying role, brand and device location', async () => {
    const { app, store } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/pin',
      payload: { ...DEVICE, employeeId: 'e1', pin: '4826' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toMatchObject({
      role: 'cashier',
      brandId: 'stopwash',
      locationIds: ['katubedda'],
    });
    const claims = await new DevJwtIssuer(TEST_SECRET).verify(body.token);
    expect(claims).toMatchObject({ uid: 'emp:e1', employeeId: 'e1', deviceId: DEVICE.deviceId });
    const audit = await store.audit.find({
      where: [{ field: 'brandId', op: '==', value: 'stopwash' }],
    });
    expect(audit.map((a) => a.action)).toContain('auth.pinSignIn');
  });

  it('locks the employee out after repeated wrong PINs', async () => {
    const { app } = await setup();
    const attempt = (pin: string) =>
      app.inject({
        method: 'POST',
        url: '/auth/pin',
        payload: { ...DEVICE, employeeId: 'e1', pin },
      });
    expect((await attempt('1112')).statusCode).toBe(401);
    expect((await attempt('1112')).statusCode).toBe(401);
    const third = await attempt('1112');
    expect(third.statusCode).toBe(423);
    expect(third.json().error.code).toBe('PIN_LOCKED');
    expect((await attempt('4826')).statusCode).toBe(423);
  });

  it('refuses staff without POS access even with a valid-looking PIN', async () => {
    const { app } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/pin',
      payload: { ...DEVICE, employeeId: 'e5', pin: '4826' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rate-limits PIN attempts per device', async () => {
    const { app } = await setup();
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/pin',
        payload: { ...DEVICE, employeeId: 'nobody', pin: '2580' },
      });
      codes.push(res.statusCode);
    }
    expect(codes.at(-1)).toBe(429);
  });
});

describe('POST /auth/email', () => {
  it('is a stub until Firebase Auth is configured', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'POST', url: '/auth/email', payload: {} });
    expect(res.statusCode).toBe(501);
  });
});

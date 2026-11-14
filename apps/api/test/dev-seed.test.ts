import { describe, expect, it } from 'vitest';
import { DEV_STAFF, seedDev } from '../src/dev/seed';
import { testApp } from './helpers';

describe('dev seed', () => {
  it('lets every role sign in on the dev counter', async () => {
    const { app, store } = await testApp();
    const device = { deviceId: 'dev-counter', deviceSecret: 'dev-counter-secret-change-me' };
    await seedDev(store, { brandId: 'stopwash', locationId: 'katubedda', ...device });
    await seedDev(store, { brandId: 'stopwash', locationId: 'katubedda', ...device }); // idempotent
    for (const s of DEV_STAFF.filter((x) => x.pin)) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/pin',
        payload: { ...device, employeeId: s.id, pin: s.pin },
      });
      expect(res.statusCode, s.name).toBe(200);
      expect(res.json().user.role).toBe(s.role);
    }
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
  });
});

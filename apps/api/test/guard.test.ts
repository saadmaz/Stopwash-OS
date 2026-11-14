import { describe, expect, it } from 'vitest';
import { assertLocation, ctxOf, guard, resolveLocation } from '../src/lib/guard';
import type { Ctx } from '../src/lib/context';
import { DevJwtIssuer } from '../src/services/tokens';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  app.get('/probe/payroll', { preHandler: guard('payroll.read') }, async (req) => ({
    who: ctxOf(req).actor.id,
  }));
  app.get('/probe/approve', { preHandler: guard('shift.approve') }, async () => ({ ok: true }));
  return app;
}

describe('guard', () => {
  it('requires a bearer token', async () => {
    const app = await setup();
    const res = await app.inject({ url: '/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects forged or foreign tokens', async () => {
    const app = await setup();
    const forged = await new DevJwtIssuer('z'.repeat(40)).issue(
      { uid: 'x', name: 'x', role: 'owner', brandId: 'stopwash', locationIds: [] },
      new Date(),
    );
    const res = await app.inject({
      url: '/me',
      headers: { authorization: `Bearer ${forged.token}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns the actor and permissions on /me', async () => {
    const app = await setup();
    const res = await app.inject({ url: '/me', headers: await authHeader(app, 'e1', '4826') });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({
      id: 'emp:e1',
      role: 'cashier',
      locationIds: ['katubedda'],
    });
    expect(res.json().permissions).toContain('order.create');
    expect(res.json().permissions).not.toContain('payroll.read');
  });

  it.each([
    ['e1', '4826', '/probe/payroll', 403], // cashier
    ['e2', '7391', '/probe/payroll', 200], // manager
    ['e2', '7391', '/probe/approve', 403], // manager cannot approve EOD (segregation of duties)
    ['e3', '5038', '/probe/approve', 200], // accounts
    ['e4', '6142', '/probe/approve', 200], // owner
  ])('%s → %s = %i', async (emp, pin, url, status) => {
    const app = await setup();
    const res = await app.inject({ url, headers: await authHeader(app, emp, pin) });
    expect(res.statusCode).toBe(status);
  });
});

describe('location checks', () => {
  const ctx = (role: Ctx['actor']['role'], locationIds: string[]): Ctx => ({
    actor: {
      id: 'u',
      name: 'u',
      role,
      brandId: 'stopwash',
      locationIds,
      employeeId: null,
      deviceId: null,
    },
    requestId: null,
    now: new Date(),
  });

  it('limits non-owners to their locations', () => {
    expect(() => assertLocation(ctx('cashier', ['katubedda']), 'katubedda')).not.toThrow();
    expect(() => assertLocation(ctx('cashier', ['katubedda']), 'colombo')).toThrow(/not assigned/);
    expect(() => assertLocation(ctx('owner', []), 'colombo')).not.toThrow();
  });

  it('resolves the counter location', () => {
    expect(resolveLocation(ctx('cashier', ['katubedda']))).toBe('katubedda');
    expect(() => resolveLocation(ctx('manager', ['a1', 'b2']))).toThrow(/locationId/);
    expect(resolveLocation(ctx('manager', ['a1', 'b2']), 'b2')).toBe('b2');
  });
});

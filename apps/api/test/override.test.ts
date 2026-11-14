import { describe, expect, it } from 'vitest';
import type { Ctx } from '../src/lib/context';
import { createMemoryStore } from '../src/repos';
import { verifyOverride } from '../src/services/override';
import { seedBasics } from './helpers';

const policy = { maxAttempts: 3, lockoutMinutes: 15 };
const ctx: Ctx = {
  actor: {
    id: 'emp:e1',
    name: 'Cashier',
    role: 'cashier',
    brandId: 'stopwash',
    locationIds: ['katubedda'],
    employeeId: 'e1',
    deviceId: 'd',
  },
  requestId: null,
  now: new Date('2026-11-15T04:00:00Z'),
};

async function setup() {
  const db = createMemoryStore();
  await seedBasics(db);
  return db;
}

describe('verifyOverride', () => {
  it('accepts a manager with the right PIN', async () => {
    const db = await setup();
    const approver = await verifyOverride(
      db,
      ctx,
      'katubedda',
      { employeeId: 'e2', pin: '7391' },
      'order.discount.override',
      policy,
    );
    expect(approver.id).toBe('e2');
  });

  it('requires an override when none is given', async () => {
    const db = await setup();
    await expect(
      verifyOverride(db, ctx, 'katubedda', null, 'order.discount.override', policy),
    ).rejects.toMatchObject({ code: 'OVERRIDE_REQUIRED' });
  });

  it('rejects a wrong PIN without saying whether the person exists', async () => {
    const db = await setup();
    await expect(
      verifyOverride(
        db,
        ctx,
        'katubedda',
        { employeeId: 'e2', pin: '1112' },
        'order.discount.override',
        policy,
      ),
    ).rejects.toMatchObject({ code: 'OVERRIDE_INVALID' });
    await expect(
      verifyOverride(
        db,
        ctx,
        'katubedda',
        { employeeId: 'ghost', pin: '1112' },
        'order.discount.override',
        policy,
      ),
    ).rejects.toMatchObject({ code: 'OVERRIDE_INVALID' });
  });

  it('a cashier cannot approve their own discount, even with a correct PIN', async () => {
    const db = await setup();
    await expect(
      verifyOverride(
        db,
        ctx,
        'katubedda',
        { employeeId: 'e1', pin: '4826' },
        'order.discount.override',
        policy,
      ),
    ).rejects.toMatchObject({ code: 'OVERRIDE_INVALID' });
  });

  it('approvers must work at the location', async () => {
    const db = await setup();
    await expect(
      verifyOverride(
        db,
        ctx,
        'colombo',
        { employeeId: 'e2', pin: '7391' },
        'order.discount.override',
        policy,
      ),
    ).rejects.toMatchObject({ code: 'OVERRIDE_INVALID' });
  });
});

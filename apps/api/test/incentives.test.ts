import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const manager = await authHeader(app, 'e2', '7391');
  const cashier = await authHeader(app, 'e1', '4826');
  const send = (
    method: 'POST' | 'PATCH',
    url: string,
    payload: Record<string, unknown>,
    h = manager,
  ) => app.inject({ method, url, headers: { ...h, 'idempotency-key': randomUUID() }, payload });
  return { app, manager, cashier, send };
}

const rule = {
  name: 'Standard',
  weekdayTiers: [
    { target: 20, bonusCents: 75000 },
    { target: 10, bonusCents: 25000 },
    { target: 15, bonusCents: 50000 },
  ],
  weekendTiers: [{ target: 15, bonusCents: 50000 }],
};

describe('incentive rules', () => {
  it('creates a rule with tiers sorted by target', async () => {
    const { send } = await setup();
    const res = await send('POST', '/incentive-rules', rule);
    expect(res.statusCode).toBe(201);
    expect(res.json().weekdayTiers.map((t: { target: number }) => t.target)).toEqual([10, 15, 20]);
  });

  it('rejects duplicate targets and cashier edits', async () => {
    const { send, cashier } = await setup();
    const dup = {
      ...rule,
      weekendTiers: [
        { target: 15, bonusCents: 1 },
        { target: 15, bonusCents: 2 },
      ],
    };
    expect((await send('POST', '/incentive-rules', dup)).statusCode).toBe(400);
    expect((await send('POST', '/incentive-rules', rule, cashier)).statusCode).toBe(403);
  });

  it('archives instead of deleting', async () => {
    const { send, app, manager } = await setup();
    const r = (await send('POST', '/incentive-rules', rule)).json();
    await send('PATCH', `/incentive-rules/${r.id}`, { archived: true });
    const active = await app.inject({ url: '/incentive-rules', headers: manager });
    expect(active.json().items).toHaveLength(0);
    const all = await app.inject({
      url: '/incentive-rules?includeArchived=true',
      headers: manager,
    });
    expect(all.json().items).toHaveLength(1);
  });
});

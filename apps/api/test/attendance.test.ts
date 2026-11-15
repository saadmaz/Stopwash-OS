import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const manager = await authHeader(app, 'e2', '7391');
  const cashier = await authHeader(app, 'e1', '4826');
  const put = (payload: Record<string, unknown>, h = manager) =>
    app.inject({
      method: 'PUT',
      url: '/attendance',
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  return { app, store, manager, cashier, put };
}

describe('attendance', () => {
  it('shows the day roster and saves marks in bulk', async () => {
    const { app, manager, put } = await setup();
    const before = (
      await app.inject({ url: '/attendance?date=2026-11-15', headers: manager })
    ).json();
    expect(before.items).toHaveLength(5);
    expect(before.items.every((r: { status: string | null }) => r.status === null)).toBe(true);
    const all = before.items.map((r: { employeeId: string }) => ({
      employeeId: r.employeeId,
      status: 'PRESENT',
    }));
    all[0].status = 'LATE';
    expect((await put({ date: '2026-11-15', entries: all })).json().saved).toBe(5);
    expect((await put({ date: '2026-11-15', entries: all })).json().saved).toBe(0); // unchanged
    const after = (
      await app.inject({ url: '/attendance?date=2026-11-15', headers: manager })
    ).json();
    expect(after.items.map((r: { status: string }) => r.status).sort()).toEqual([
      'LATE',
      'PRESENT',
      'PRESENT',
      'PRESENT',
      'PRESENT',
    ]);
    const report = (
      await app.inject({
        url: '/attendance/report?from=2026-11-01&to=2026-11-30',
        headers: manager,
      })
    ).json();
    expect(report.items).toHaveLength(5);
  });

  it('cashiers cannot mark attendance', async () => {
    const { put, cashier } = await setup();
    const res = await put(
      { date: '2026-11-15', entries: [{ employeeId: 'e1', status: 'PRESENT' }] },
      cashier,
    );
    expect(res.statusCode).toBe(403);
  });
});

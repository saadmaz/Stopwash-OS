import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { authHeader, seedBasics, testApp } from './helpers';

async function setup() {
  const { app, store } = await testApp();
  await seedBasics(store);
  const cashier = await authHeader(app, 'e1', '4826');
  const manager = await authHeader(app, 'e2', '7391');
  const post = (url: string, payload: Record<string, unknown>, h = cashier) =>
    app.inject({
      method: 'POST',
      url,
      headers: { ...h, 'idempotency-key': randomUUID() },
      payload,
    });
  return { app, store, cashier, manager, post };
}

const req = {
  employeeId: 'e1',
  startDate: '2026-11-20',
  endDate: '2026-11-22',
  reason: 'Family wedding',
};

describe('leave', () => {
  it('staff request their own leave; the day count is inclusive', async () => {
    const { post } = await setup();
    const res = await post('/leaves', req);
    expect(res.json()).toMatchObject({ status: 'PENDING', days: 3, employeeName: 'Staff e1' });
    expect((await post('/leaves', { ...req, employeeId: 'e2' })).statusCode).toBe(403);
    expect((await post('/leaves', { ...req, endDate: '2026-11-19' })).statusCode).toBe(400);
  });

  it('managers approve, which marks the days as LEAVE in attendance', async () => {
    const { post, manager, store } = await setup();
    const leave = (await post('/leaves', req)).json();
    expect((await post(`/leaves/${leave.id}/decision`, { decision: 'APPROVED' })).statusCode).toBe(
      403,
    );
    const ok = await post(`/leaves/${leave.id}/decision`, { decision: 'APPROVED' }, manager);
    expect(ok.json().status).toBe('APPROVED');
    const days = await store.attendance.find({
      where: [{ field: 'brandId', op: '==', value: 'stopwash' }],
    });
    expect(days.map((d) => `${d.date}:${d.status}`)).toEqual([
      '2026-11-20:LEAVE',
      '2026-11-21:LEAVE',
      '2026-11-22:LEAVE',
    ]);
    expect(
      (await post(`/leaves/${leave.id}/decision`, { decision: 'REJECTED' }, manager)).statusCode,
    ).toBe(409);
  });

  it('staff see only their own requests and can cancel pending ones', async () => {
    const { post, app, cashier, manager } = await setup();
    const mine = (await post('/leaves', req)).json();
    await post('/leaves', { ...req, employeeId: 'e3' }, manager);
    expect((await app.inject({ url: '/leaves', headers: cashier })).json().items).toHaveLength(1);
    expect((await app.inject({ url: '/leaves', headers: manager })).json().items).toHaveLength(2);
    const c = await post(`/leaves/${mine.id}/cancel`, {});
    expect(c.json().status).toBe('CANCELLED');
  });
});

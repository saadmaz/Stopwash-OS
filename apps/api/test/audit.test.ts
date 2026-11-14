import { describe, expect, it } from 'vitest';
import type { Ctx } from '../src/lib/context';
import { newId } from '../src/lib/ids';
import { createMemoryStore } from '../src/repos';
import { audit, listAudit, redact } from '../src/services/audit';

const ctx = (at: string, actorId = 'u1'): Ctx => ({
  actor: {
    id: actorId,
    name: 'Nimal',
    role: 'manager',
    brandId: 'stopwash',
    locationIds: ['katubedda'],
    employeeId: 'e1',
    deviceId: 'd1',
  },
  requestId: 'req-1',
  now: new Date(at),
});

describe('audit', () => {
  it('records who, what, when, before/after and request context', async () => {
    const db = createMemoryStore();
    const e = await audit(db, ctx('2026-11-15T04:00:00Z'), {
      action: 'employee.update',
      entity: 'employee',
      entityId: 'e9',
      locationId: 'katubedda',
      before: { name: 'A' },
      after: { name: 'B' },
      reason: 'typo',
    });
    expect(e).toMatchObject({
      actorId: 'u1',
      actorName: 'Nimal',
      actorRole: 'manager',
      at: '2026-11-15T04:00:00.000Z',
      before: { name: 'A' },
      after: { name: 'B' },
      requestId: 'req-1',
      deviceId: 'd1',
    });
  });

  it('never stores secrets', () => {
    expect(redact({ name: 'x', pinHash: 'h', nested: [{ pin: '1234' }] })).toEqual({
      name: 'x',
      pinHash: '[redacted]',
      nested: [{ pin: '[redacted]' }],
    });
  });

  it('rolls back with the change it describes', async () => {
    const db = createMemoryStore();
    await expect(
      db.transaction(async (tx) => {
        await audit(tx, ctx('2026-11-15T04:00:00Z'), {
          action: 'order.create',
          entity: 'order',
          entityId: 'o1',
        });
        throw new Error('write failed');
      }),
    ).rejects.toThrow();
    expect((await listAudit(db, 'stopwash', {})).total).toBe(0);
  });

  it('lists newest first with filters and paging', async () => {
    const db = createMemoryStore();
    const times = ['2026-11-14T10:00:00Z', '2026-11-15T10:00:00Z', '2026-11-15T11:00:00Z'];
    for (const [i, at] of times.entries()) {
      await audit(db, ctx(at, i === 0 ? 'u2' : 'u1'), {
        action: 'order.create',
        entity: 'order',
        entityId: `o${i}`,
      });
    }
    const all = await listAudit(db, 'stopwash', { limit: 2 });
    expect(all.total).toBe(3);
    expect(all.items.map((e) => e.entityId)).toEqual(['o2', 'o1']);
    const day = await listAudit(db, 'stopwash', { from: '2026-11-15T00:00:00Z', actorId: 'u1' });
    expect(day.items).toHaveLength(2);
    expect((await listAudit(db, 'otherbrand', {})).total).toBe(0);
  });
});

describe('newId', () => {
  it('sorts by creation time', () => {
    const a = newId(new Date('2026-01-01T00:00:00Z'));
    const b = newId(new Date('2026-01-01T00:00:00.001Z'));
    expect(a < b).toBe(true);
    expect(a).toHaveLength(21);
  });
});

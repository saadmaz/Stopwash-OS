import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/repos/memory';
import { eq, type Location } from '../src/repos/types';

const loc = (id: string, brandId = 'stopwash'): Location => ({
  id,
  brandId,
  code: id.slice(0, 3).toUpperCase(),
  name: id,
  timezone: 'Asia/Colombo',
  active: true,
  openShiftId: null,
});

describe('MemoryDataStore', () => {
  it('stores copies, so callers cannot mutate stored records', async () => {
    const db = createMemoryStore();
    const doc = loc('katubedda');
    await db.locations.insert(doc);
    doc.name = 'changed';
    expect((await db.locations.get('katubedda'))?.name).toBe('katubedda');
  });

  it('refuses duplicate inserts and updates to missing records', async () => {
    const db = createMemoryStore();
    await db.locations.insert(loc('a1'));
    await expect(db.locations.insert(loc('a1'))).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(db.locations.update('zz', { name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses queries that are not scoped to a brand', async () => {
    const db = createMemoryStore();
    await expect(db.locations.find({ where: [] })).rejects.toThrow(/brandId/);
  });

  it('never returns another brand’s data', async () => {
    const db = createMemoryStore();
    await db.locations.insert(loc('l1', 'stopwash'));
    await db.locations.insert(loc('l2', 'otherbrand'));
    const rows = await db.locations.find({ where: [eq('brandId', 'stopwash')] });
    expect(rows.map((r) => r.id)).toEqual(['l1']);
  });

  it('filters, orders, limits and counts', async () => {
    const db = createMemoryStore();
    for (const id of ['cc', 'aa', 'bb']) await db.locations.insert(loc(id));
    const rows = await db.locations.find({
      where: [eq('brandId', 'stopwash'), { field: 'id', op: '!=', value: 'bb' }],
      orderBy: { field: 'id', dir: 'desc' },
      limit: 5,
    });
    expect(rows.map((r) => r.id)).toEqual(['cc', 'aa']);
    expect(await db.locations.count({ where: [eq('brandId', 'stopwash')], limit: 1 })).toBe(3);
  });

  it('blocks updates on append-only collections', async () => {
    const db = createMemoryStore();
    const payments = db.payments as unknown as {
      update: (id: string, p: object) => Promise<unknown>;
    };
    await expect(payments.update('p1', {})).rejects.toThrow(/append-only/);
  });

  it('rolls back every write when a transaction fails', async () => {
    const db = createMemoryStore();
    await db.locations.insert(loc('keep'));
    await expect(
      db.transaction(async (tx) => {
        await tx.locations.insert(loc('ghost'));
        await tx.locations.update('keep', { name: 'mutated' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.locations.get('ghost')).toBeNull();
    expect((await db.locations.get('keep'))?.name).toBe('keep');
  });

  it('serialises concurrent transactions so counters never collide', async () => {
    const db = createMemoryStore();
    const values = await Promise.all(
      Array.from({ length: 20 }, () =>
        db.transaction(async (tx) => {
          const v = await tx.counters.next('stopwash', 'receipt-20261115');
          await new Promise((r) => setTimeout(r, Math.random() * 3));
          return v;
        }),
      ),
    );
    expect([...values].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('lets nested transactions join the outer one', async () => {
    const db = createMemoryStore();
    const v = await db.transaction(async (tx) => {
      await tx.locations.insert(loc('n1'));
      return db.transaction(async (inner) => (await inner.locations.get('n1'))?.id);
    });
    expect(v).toBe('n1');
  });

  it('counters start from a seed', async () => {
    const db = createMemoryStore();
    expect(await db.counters.next('stopwash', 'invoice', 55100)).toBe(55100);
    expect(await db.counters.next('stopwash', 'invoice', 55100)).toBe(55101);
  });
});

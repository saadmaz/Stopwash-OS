import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/repos';
import { getConfig } from '../src/services/config';
import { ensureDefaults } from '../src/services/defaults';
import { authHeader, seedBasics, testApp } from './helpers';

describe('defaults', () => {
  it('reproduce SWOMS 2.5 prices, checklist and cash categories', async () => {
    const db = createMemoryStore();
    await ensureDefaults(db, 'stopwash', 'katubedda', new Date());
    const cfg = await getConfig(db, 'stopwash', 'katubedda');
    const price = (code: string) => cfg.catalog.find((c) => c.code === code)?.priceCents;
    expect([price('BIKE'), price('SMALL'), price('MEDIUM'), price('LARGE')]).toEqual([
      50000, 75000, 100000, 125000,
    ]);
    expect([price('WAX'), price('VACUUM_ADDON')]).toEqual([25000, 25000]);
    expect([price('AIR_FRESHENER'), price('VACUUM_PRODUCT'), price('WIPER_FLUID')]).toEqual([
      50000, 50000, 25000,
    ]);
    expect(cfg.checklistItems.filter((c) => c.kind === 'stock')).toHaveLength(5);
    expect(cfg.checklistItems.filter((c) => c.kind === 'equipment')).toHaveLength(4);
    expect(cfg.cashCategories.map((c) => c.code)).toEqual([
      'E001',
      'E002',
      'E003',
      'E004',
      'E005',
      'E006',
      'E007',
      'D001',
      'D002',
      'D003',
    ]);
    expect(cfg.settings.variance).toEqual({ explainAboveCents: 50000, overrideAboveCents: 200000 });
  });

  it('are idempotent', async () => {
    const db = createMemoryStore();
    await ensureDefaults(db, 'stopwash', 'katubedda', new Date());
    await ensureDefaults(db, 'stopwash', 'katubedda', new Date());
    expect(
      await db.catalog.count({ where: [{ field: 'brandId', op: '==', value: 'stopwash' }] }),
    ).toBe(9);
  });
});

describe('GET /config', () => {
  it('serves the counter its configuration', async () => {
    const { app, store } = await testApp();
    await seedBasics(store);
    const res = await app.inject({ url: '/config', headers: await authHeader(app, 'e1', '4826') });
    expect(res.statusCode).toBe(200);
    expect(res.json().locationId).toBe('katubedda');
    expect(res.json().catalog).toHaveLength(9);
  });

  it('refuses another location', async () => {
    const { app, store } = await testApp();
    await seedBasics(store);
    const res = await app.inject({
      url: '/config?locationId=colombo',
      headers: await authHeader(app, 'e1', '4826'),
    });
    expect(res.statusCode).toBe(403);
  });
});

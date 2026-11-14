import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  discountPercent,
  loyaltyDiscount,
  priceOrder,
  type PricingError,
  summarizeLines,
  visitsUntilReward,
  type CatalogItem,
} from '../src';

const mk = (
  code: string,
  kind: CatalogItem['kind'],
  priceCents: number,
  maxQty = 1,
  active = true,
): CatalogItem => ({
  id: code.toLowerCase(),
  brandId: 'stopwash',
  createdAt: '2026-11-15T00:00:00.000Z',
  createdBy: 'seed',
  updatedAt: null,
  updatedBy: null,
  kind,
  code,
  name: { en: code },
  description: null,
  priceCents,
  maxQty,
  locationIds: null,
  icon: null,
  sort: 0,
  active,
});

// SWOMS 2.5 prices
const catalog = new Map(
  [
    mk('BIKE', 'vehicleClass', 50000),
    mk('SMALL', 'vehicleClass', 75000),
    mk('MEDIUM', 'vehicleClass', 100000),
    mk('LARGE', 'vehicleClass', 125000),
    mk('WAX', 'addon', 25000),
    mk('VACUUM_ADDON', 'addon', 25000),
    mk('AIR_FRESHENER', 'product', 50000, 10),
    mk('WIPER_FLUID', 'product', 25000, 10),
    mk('OLD', 'addon', 10000, 1, false),
  ].map((i) => [i.id, i]),
);

const code = (err: unknown) => (err as PricingError).code;
const fails = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return code(e);
  }
  return null;
};

describe('priceOrder', () => {
  it('matches the old calculateTotal for a wash with add-ons and products', () => {
    // Medium 1000 + Wax 250 + Air freshener 500×2 + Wiper fluid 250 = 2,500
    const p = priceOrder(catalog, [
      { itemId: 'air_freshener', qty: 2 },
      { itemId: 'medium', qty: 1 },
      { itemId: 'wax', qty: 1 },
      { itemId: 'wiper_fluid', qty: 1 },
    ]);
    expect(p.subtotalCents).toBe(250000);
    expect(p.totalCents).toBe(250000);
    expect(p.lines.map((l) => l.code)).toEqual(['MEDIUM', 'WAX', 'AIR_FRESHENER', 'WIPER_FLUID']);
    expect(p.lines[2]).toMatchObject({ unitPriceCents: 50000, qty: 2, totalCents: 100000 });
  });

  it('allows product-only orders but not add-on-only orders', () => {
    expect(priceOrder(catalog, [{ itemId: 'air_freshener', qty: 1 }]).totalCents).toBe(50000);
    expect(fails(() => priceOrder(catalog, [{ itemId: 'wax', qty: 1 }]))).toBe('NO_BILLABLE_ITEM');
  });

  it('allows only one vehicle class', () => {
    expect(
      fails(() =>
        priceOrder(catalog, [
          { itemId: 'small', qty: 1 },
          { itemId: 'large', qty: 1 },
        ]),
      ),
    ).toBe('MULTIPLE_VEHICLE_CLASSES');
  });

  it('merges repeated lines and enforces max quantity', () => {
    const p = priceOrder(catalog, [
      { itemId: 'bike', qty: 1 },
      { itemId: 'wiper_fluid', qty: 1 },
      { itemId: 'wiper_fluid', qty: 2 },
    ]);
    expect(p.lines.find((l) => l.code === 'WIPER_FLUID')?.qty).toBe(3);
    expect(
      fails(() =>
        priceOrder(catalog, [
          { itemId: 'bike', qty: 1 },
          { itemId: 'wax', qty: 2 },
        ]),
      ),
    ).toBe('QTY_LIMIT');
  });

  it('rejects unknown and inactive items', () => {
    expect(fails(() => priceOrder(catalog, [{ itemId: 'nope', qty: 1 }]))).toBe('UNKNOWN_ITEM');
    expect(
      fails(() =>
        priceOrder(catalog, [
          { itemId: 'small', qty: 1 },
          { itemId: 'old', qty: 1 },
        ]),
      ),
    ).toBe('INACTIVE_ITEM');
  });

  it('applies a manual discount but never below zero', () => {
    const p = priceOrder(catalog, [{ itemId: 'small', qty: 1 }], { discountCents: 15000 });
    expect(p.totalCents).toBe(60000);
    expect(
      fails(() => priceOrder(catalog, [{ itemId: 'small', qty: 1 }], { discountCents: 80000 })),
    ).toBe('DISCOUNT_TOO_LARGE');
    expect(discountPercent(15000, 75000)).toBe(20);
  });

  it('stacks loyalty then manual discount', () => {
    const p = priceOrder(catalog, [{ itemId: 'small', qty: 1 }], {
      loyaltyDiscountCents: 37500,
      discountCents: 37500,
    });
    expect(p.totalCents).toBe(0);
    expect(
      fails(() =>
        priceOrder(catalog, [{ itemId: 'small', qty: 1 }], {
          loyaltyDiscountCents: 37500,
          discountCents: 37501,
        }),
      ),
    ).toBe('DISCOUNT_TOO_LARGE');
  });

  it('handles inclusive and exclusive tax', () => {
    const tax = { ...DEFAULT_SETTINGS.tax, enabled: true, ratePct: 18 };
    const inc = priceOrder(catalog, [{ itemId: 'small', qty: 1 }], {
      tax: { ...tax, inclusive: true },
    });
    expect(inc.totalCents).toBe(75000);
    expect(inc.taxCents).toBe(11441); // 750 × 18/118 = 114.41
    const exc = priceOrder(catalog, [{ itemId: 'small', qty: 1 }], {
      tax: { ...tax, inclusive: false },
    });
    expect(exc.taxCents).toBe(13500);
    expect(exc.totalCents).toBe(88500);
  });
});

describe('loyalty', () => {
  const rule = { enabled: true, everyNth: 6, rewardPct: 50 };

  it('rewards every Nth visit', () => {
    expect(loyaltyDiscount(4, rule, 100000)).toBe(0); // 5th visit
    expect(loyaltyDiscount(5, rule, 100000)).toBe(50000); // 6th visit
    expect(loyaltyDiscount(11, rule, 100000)).toBe(50000); // 12th visit
    expect(loyaltyDiscount(5, { ...rule, enabled: false }, 100000)).toBe(0);
  });

  it('counts down to the next reward', () => {
    expect(visitsUntilReward(0, 6)).toBe(5);
    expect(visitsUntilReward(5, 6)).toBe(0);
    expect(visitsUntilReward(6, 6)).toBe(5);
  });
});

describe('summarizeLines', () => {
  it('reads like the old services column', () => {
    expect(
      summarizeLines([
        { name: 'Medium (SUV)', qty: 1 },
        { name: 'Wax', qty: 1 },
        { name: 'Air freshener', qty: 2 },
      ]),
    ).toBe('Medium (SUV) + Wax + Air freshener ×2');
  });
});

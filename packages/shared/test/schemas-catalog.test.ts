import { describe, expect, it } from 'vitest';
import { CatalogItemInput, DEFAULT_SETTINGS, OptionalText, Settings } from '../src';

describe('settings schema', () => {
  it('accepts the SWOMS-parity defaults', () => {
    expect(Settings.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.variance).toEqual({
      explainAboveCents: 50000,
      overrideAboveCents: 200000,
    });
    expect(DEFAULT_SETTINGS.dailyVehicleTarget).toBe(15);
  });

  it('rejects an override threshold below the explanation threshold', () => {
    const bad = {
      ...DEFAULT_SETTINGS,
      variance: { explainAboveCents: 50000, overrideAboveCents: 100 },
    };
    expect(Settings.safeParse(bad).success).toBe(false);
  });

  it('rejects fractional cents', () => {
    const bad = { ...DEFAULT_SETTINGS, cashOut: { approvalAboveCents: 10.5 } };
    expect(Settings.safeParse(bad).success).toBe(false);
  });
});

describe('catalog item', () => {
  const base = {
    kind: 'vehicleClass',
    code: 'SMALL',
    name: { en: 'Small car' },
    description: '  ',
    priceCents: 75000,
    maxQty: 1,
    locationIds: null,
    icon: 'car',
    sort: 2,
    active: true,
  };

  it('normalises blank descriptions to null', () => {
    expect(CatalogItemInput.parse(base).description).toBeNull();
  });

  it('enforces code format and non-negative prices', () => {
    expect(CatalogItemInput.safeParse({ ...base, code: 'small car' }).success).toBe(false);
    expect(CatalogItemInput.safeParse({ ...base, priceCents: -1 }).success).toBe(false);
  });

  it('OptionalText trims and collapses spaces', () => {
    expect(OptionalText().parse('  hello   there ')).toBe('hello there');
    expect(OptionalText().parse(undefined)).toBeNull();
  });
});

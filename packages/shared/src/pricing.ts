import { inclusiveTax, multiply, percentOf, subtract, sum, type Cents } from './money';
import type { CatalogItem, Settings } from './schemas/catalog';
import type { OrderLine } from './schemas/operations';

export type PricingErrorCode =
  | 'UNKNOWN_ITEM'
  | 'INACTIVE_ITEM'
  | 'QTY_LIMIT'
  | 'MULTIPLE_VEHICLE_CLASSES'
  | 'NO_BILLABLE_ITEM'
  | 'DISCOUNT_TOO_LARGE';

export class PricingError extends Error {
  override name = 'PricingError';
  constructor(
    readonly code: PricingErrorCode,
    message: string,
    readonly itemId?: string,
  ) {
    super(message);
  }
}

export interface LineInput {
  itemId: string;
  qty: number;
}

export interface PricingOptions {
  /** Manual discount in cents (validated against the subtotal). */
  discountCents?: Cents;
  /** Automatic loyalty discount, already computed (see loyaltyDiscount). */
  loyaltyDiscountCents?: Cents;
  tax?: Settings['tax'];
}

export interface PricedOrder {
  lines: OrderLine[];
  subtotalCents: Cents;
  discountCents: Cents;
  loyaltyDiscountCents: Cents;
  /** Tax contained in (inclusive) or added to (exclusive) the total. */
  taxCents: Cents;
  totalCents: Cents;
}

/** Merge repeated items so "Air freshener ×1, Air freshener ×2" becomes one line of 3. */
export function mergeLines(lines: readonly LineInput[]): LineInput[] {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.itemId, (map.get(l.itemId) ?? 0) + l.qty);
  return [...map].map(([itemId, qty]) => ({ itemId, qty }));
}

/**
 * Prices an order from the catalog. The server always calls this; client totals are never trusted.
 * Rules carried over from SWOMS: one vehicle class at most, and an order needs a vehicle class
 * or a product (add-ons alone are not enough).
 */
export function priceOrder(
  catalog: ReadonlyMap<string, CatalogItem>,
  input: readonly LineInput[],
  opts: PricingOptions = {},
): PricedOrder {
  const merged = mergeLines(input);
  const lines: OrderLine[] = merged.map(({ itemId, qty }) => {
    const item = catalog.get(itemId);
    if (!item) throw new PricingError('UNKNOWN_ITEM', `Unknown item ${itemId}`, itemId);
    if (!item.active)
      throw new PricingError('INACTIVE_ITEM', `${item.code} is not available`, itemId);
    if (qty < 1 || qty > item.maxQty) {
      throw new PricingError(
        'QTY_LIMIT',
        `${item.code}: quantity must be 1–${item.maxQty}`,
        itemId,
      );
    }
    return {
      itemId,
      kind: item.kind,
      code: item.code,
      name: item.name.en,
      unitPriceCents: item.priceCents,
      qty,
      totalCents: multiply(item.priceCents, qty),
    };
  });

  const classes = lines.filter((l) => l.kind === 'vehicleClass');
  if (classes.length > 1)
    throw new PricingError('MULTIPLE_VEHICLE_CLASSES', 'Choose one vehicle class');
  if (classes.length === 0 && !lines.some((l) => l.kind === 'product')) {
    throw new PricingError('NO_BILLABLE_ITEM', 'Add a vehicle class or a product');
  }
  // Vehicle class first, then add-ons, then products (receipt order).
  const rank = { vehicleClass: 0, addon: 1, product: 2 } as const;
  lines.sort((a, b) => rank[a.kind] - rank[b.kind]);

  const subtotalCents = sum(lines.map((l) => l.totalCents));
  const loyaltyDiscountCents = Math.min(opts.loyaltyDiscountCents ?? 0, subtotalCents);
  const discountCents = opts.discountCents ?? 0;
  if (discountCents < 0 || discountCents > subtract(subtotalCents, loyaltyDiscountCents)) {
    throw new PricingError('DISCOUNT_TOO_LARGE', 'Discount is larger than the order');
  }
  const net = subtract(subtract(subtotalCents, loyaltyDiscountCents), discountCents);

  let taxCents = 0;
  let totalCents = net;
  if (opts.tax?.enabled) {
    if (opts.tax.inclusive) taxCents = inclusiveTax(net, opts.tax.ratePct);
    else {
      taxCents = percentOf(net, opts.tax.ratePct);
      totalCents = net + taxCents;
    }
  }
  return { lines, subtotalCents, discountCents, loyaltyDiscountCents, taxCents, totalCents };
}

/** Discount as a percentage of the subtotal, for the manager-override threshold. */
export function discountPercent(discountCents: Cents, subtotalCents: Cents): number {
  if (subtotalCents <= 0) return 0;
  return (discountCents / subtotalCents) * 100;
}

/**
 * Loyalty: every Nth completed visit for a vehicle gets `rewardPct` off the wash (vehicle class line).
 * `completedVisits` counts visits before this one.
 */
export function loyaltyDiscount(
  completedVisits: number,
  loyalty: Settings['loyalty'],
  washPriceCents: Cents,
): Cents {
  if (!loyalty.enabled || washPriceCents <= 0) return 0;
  return (completedVisits + 1) % loyalty.everyNth === 0
    ? percentOf(washPriceCents, loyalty.rewardPct)
    : 0;
}

/** Visits left until the next reward (0 means this visit is rewarded). */
export function visitsUntilReward(completedVisits: number, everyNth: number): number {
  const next = completedVisits + 1;
  return (everyNth - (next % everyNth)) % everyNth;
}

/** Short human summary used on receipts and the queue: "Medium (SUV) + Wax + Air freshener ×2". */
export function summarizeLines(lines: readonly Pick<OrderLine, 'name' | 'qty'>[]): string {
  return lines.map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(' + ');
}

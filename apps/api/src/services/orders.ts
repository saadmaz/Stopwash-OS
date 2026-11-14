import {
  businessDate,
  priceOrder,
  PricingError,
  type CatalogItem,
  type CreateOrderInput,
  type Order,
} from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { recordVisit } from './customers';

export async function loadCatalog(
  repos: Pick<Repositories, 'catalog'>,
  brandId: string,
  locationId: string,
): Promise<Map<string, CatalogItem>> {
  const items = await repos.catalog.find({ where: [eq('brandId', brandId)] });
  return new Map(
    items
      .filter((i) => i.locationIds === null || i.locationIds.includes(locationId))
      .map((i) => [i.id, i]),
  );
}

/** Pricing failures become validation errors the counter can show next to the line. */
export function asAppError(e: unknown): never {
  if (e instanceof PricingError) {
    throw new AppError('VALIDATION_FAILED', e.message, { pricing: e.code, itemId: e.itemId });
  }
  throw e;
}

export async function locationTimezone(
  repos: Pick<Repositories, 'locations'>,
  brandId: string,
  locationId: string,
): Promise<string> {
  const loc = await repos.locations.get(locationId);
  if (!loc || loc.brandId !== brandId || !loc.active)
    throw new AppError('NOT_FOUND', 'Unknown location');
  return loc.timezone;
}

/** Creates a QUEUED order. Prices come from the catalog, never from the client. */
export async function createOrder(
  tx: Repositories,
  ctx: Ctx,
  locationId: string,
  input: CreateOrderInput,
): Promise<Order> {
  const brandId = ctx.actor.brandId;
  const tz = await locationTimezone(tx, brandId, locationId);
  const catalog = await loadCatalog(tx, brandId, locationId);
  let priced;
  try {
    priced = priceOrder(catalog, input.lines);
  } catch (e) {
    asAppError(e);
  }
  const vehicleClass = priced.lines.find((l) => l.kind === 'vehicleClass')?.code ?? null;
  const visit = await recordVisit(tx, ctx, {
    plate: input.plate,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    vehicleClassCode: vehicleClass,
  });
  const day = businessDate(ctx.now, tz);
  const ticket = await tx.counters.next(brandId, `ticket-${locationId}-${day}`);
  const at = ctx.now.toISOString();
  const order: Order = {
    id: newId(ctx.now),
    brandId,
    locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    updatedAt: null,
    updatedBy: null,
    number: null,
    ticket,
    plateKey: visit.vehicle.plateKey,
    plateDisplay: visit.vehicle.plateDisplay,
    customerId: visit.customer?.id ?? null,
    customerName: input.customerName ?? visit.customer?.name ?? null,
    customerPhone: visit.customer?.phone ?? null,
    returning: visit.returning,
    lines: priced.lines,
    subtotalCents: priced.subtotalCents,
    discountCents: 0,
    discountReason: null,
    loyaltyDiscountCents: 0,
    taxCents: 0,
    totalCents: priced.totalCents,
    paidCents: 0,
    status: 'QUEUED',
    statusHistory: [{ status: 'QUEUED', at, by: ctx.actor.id }],
    assignedEmployeeId: input.assignedEmployeeId,
    shiftId: null,
    businessDate: day,
    completedAt: null,
    cancelReason: null,
    backdated: false,
    source: ctx.actor.deviceId ? 'counter' : 'floor',
  };
  await tx.orders.insert(order);
  await audit(tx, ctx, {
    action: 'order.create',
    entity: 'order',
    entityId: order.id,
    locationId,
    after: order,
  });
  return order;
}

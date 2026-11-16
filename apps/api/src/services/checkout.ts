import {
  businessDate,
  discountPercent,
  loyaltyDiscount,
  priceOrder,
  summarizeLines,
  sum,
  type CheckoutInput,
  type Employee,
  type Order,
  type Payment,
} from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { assertLocation } from '../lib/guard';
import { newId } from '../lib/ids';
import type { Repositories } from '../repos';
import { audit } from './audit';
import { getSettings } from './config';
import { vehicleId } from './customers';
import { asAppError, loadCatalog, locationTimezone } from './orders';

/** Receipt number in the SWOMS format: DDMM + 3-digit sequence for the location's day (ADR-0033). */
export function receiptNumber(day: string, seq: number): string {
  const [, mm, dd] = day.split('-');
  return `${dd}${mm}${String(seq).padStart(3, '0')}`;
}

export interface CheckoutResult {
  order: Order;
  payments: Payment[];
}

/**
 * Completes and pays an order in one transaction. The total is re-priced from the order's
 * snapshotted lines (not the client), tenders must match it exactly, and payments are appended.
 * `approver` is a manager already verified outside the transaction (so failed PINs still count).
 */
export async function checkout(
  tx: Repositories,
  ctx: Ctx,
  orderId: string,
  input: CheckoutInput,
  approver: Employee | null,
): Promise<CheckoutResult> {
  const order = await tx.orders.get(orderId);
  if (!order || order.brandId !== ctx.actor.brandId)
    throw new AppError('NOT_FOUND', 'Order not found');
  assertLocation(ctx, order.locationId);
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new AppError('ORDER_NOT_EDITABLE', `Order is already ${order.status.toLowerCase()}`);
  }
  const location = await tx.locations.get(order.locationId);
  const shift = location?.openShiftId ? await tx.shifts.get(location.openShiftId) : null;
  if (!shift || shift.status !== 'OPEN')
    throw new AppError('SHIFT_NOT_OPEN', 'Open a shift before taking payments');

  const { priced, settings, vehicle, loyalty } = await quoteOrder(
    tx,
    ctx,
    order,
    input.discountCents,
  );
  if (input.discountCents > 0 && !input.discountReason) {
    throw new AppError('VALIDATION_FAILED', 'Give a reason for the discount');
  }
  if (
    discountPercent(input.discountCents, priced.subtotalCents) >
      settings.discount.overrideAbovePct &&
    !approver
  ) {
    throw new AppError('OVERRIDE_REQUIRED', 'A manager needs to approve this discount', {
      limitPct: settings.discount.overrideAbovePct,
    });
  }
  return finish(tx, ctx, order, shift.id, input, approver, priced, vehicle, loyalty);
}

/** Exact server total for an open order (loyalty and tax included) without changing anything. */
export async function quoteOrder(tx: Repositories, ctx: Ctx, order: Order, discountCents: number) {
  const settings = await getSettings(tx, ctx.actor.brandId, order.locationId);
  const catalog = await loadCatalog(tx, ctx.actor.brandId, order.locationId);
  // Re-price from the order's own snapshot so later price changes don't affect a queued car.
  for (const l of order.lines) {
    const live = catalog.get(l.itemId);
    if (live)
      catalog.set(l.itemId, {
        ...live,
        active: true,
        priceCents: l.unitPriceCents,
        maxQty: Math.max(live.maxQty, l.qty),
      });
  }
  const vehicle = await tx.vehicles.get(vehicleId(ctx.actor.brandId, order.plateKey));
  const wash = order.lines.find((l) => l.kind === 'vehicleClass')?.totalCents ?? 0;
  const loyalty = loyaltyDiscount(vehicle?.completedVisits ?? 0, settings.loyalty, wash);

  let priced;
  try {
    priced = priceOrder(
      catalog,
      order.lines.map((l) => ({ itemId: l.itemId, qty: l.qty })),
      {
        discountCents,
        loyaltyDiscountCents: loyalty,
        tax: settings.tax,
      },
    );
  } catch (e) {
    asAppError(e);
  }
  return {
    priced,
    settings,
    vehicle,
    loyalty,
    discountNeedsApproval:
      discountPercent(discountCents, priced.subtotalCents) > settings.discount.overrideAbovePct,
  };
}

async function finish(
  tx: Repositories,
  ctx: Ctx,
  order: Order,
  shiftId: string,
  input: CheckoutInput,
  approver: Employee | null,
  priced: Awaited<ReturnType<typeof quoteOrder>>['priced'],
  vehicle: Awaited<ReturnType<typeof quoteOrder>>['vehicle'],
  loyalty: number,
): Promise<CheckoutResult> {
  const tendered = sum(input.tenders.map((t) => t.amountCents));
  if (tendered !== priced.totalCents) {
    throw new AppError('TENDER_MISMATCH', 'Payments must add up to the total', {
      totalCents: priced.totalCents,
      tenderedCents: tendered,
    });
  }

  const tz = await locationTimezone(tx, ctx.actor.brandId, order.locationId);
  const day = businessDate(ctx.now, tz);
  const seq = await tx.counters.next(ctx.actor.brandId, `receipt-${order.locationId}-${day}`);
  const at = ctx.now.toISOString();
  const payments: Payment[] = [];
  for (const t of input.tenders) {
    payments.push(
      await tx.payments.insert({
        id: newId(ctx.now),
        brandId: ctx.actor.brandId,
        locationId: order.locationId,
        createdAt: at,
        createdBy: ctx.actor.id,
        orderId: order.id,
        shiftId,
        businessDate: day,
        method: t.method,
        amountCents: t.amountCents,
        reversesId: null,
        reason: null,
      }),
    );
  }
  const completed = await tx.orders.update(order.id, {
    status: 'COMPLETED',
    number: receiptNumber(day, seq),
    discountCents: priced.discountCents,
    discountReason: input.discountReason,
    loyaltyDiscountCents: priced.loyaltyDiscountCents,
    taxCents: priced.taxCents,
    totalCents: priced.totalCents,
    paidCents: tendered,
    shiftId,
    completedAt: at,
    statusHistory: [...order.statusHistory, { status: 'COMPLETED', at, by: ctx.actor.id }],
    updatedAt: at,
    updatedBy: ctx.actor.id,
  });
  if (vehicle) {
    await tx.vehicles.update(vehicle.id, {
      completedVisits: vehicle.completedVisits + 1,
      totalSpentCents: vehicle.totalSpentCents + priced.totalCents,
      lastServiceSummary: summarizeLines(order.lines),
      loyaltyProgress: loyalty > 0 ? 0 : vehicle.loyaltyProgress + 1,
      updatedAt: at,
    });
  }
  if (order.customerId) {
    const c = await tx.customers.get(order.customerId);
    if (c)
      await tx.customers.update(c.id, {
        totalSpentCents: c.totalSpentCents + priced.totalCents,
        updatedAt: at,
      });
  }
  await audit(tx, ctx, {
    action: 'order.checkout',
    entity: 'order',
    entityId: order.id,
    locationId: order.locationId,
    before: { status: order.status, totalCents: order.totalCents },
    after: {
      status: 'COMPLETED',
      number: completed.number,
      totalCents: priced.totalCents,
      tenders: input.tenders,
      approvedBy: approver?.id ?? null,
    },
    reason: input.discountReason,
  });
  return { order: completed, payments };
}

import {
  businessDate,
  normalizePhone,
  plateDisplay,
  plateKey,
  priceOrder,
  type Order,
  type Payment,
} from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { assertLocation } from '../lib/guard';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { recordVisit, vehicleId } from './customers';
import { asAppError, loadCatalog, locationTimezone } from './orders';

export const EditOrderInput = z.object({
  plate: z.string().trim().min(1).max(24).optional(),
  customerName: z.string().trim().max(80).nullable().optional(),
  customerPhone: z.string().trim().max(20).nullable().optional(),
  lines: z
    .array(z.object({ itemId: z.string().min(1), qty: z.number().int().min(1).max(99) }))
    .min(1)
    .max(30)
    .optional(),
  reason: z.string().trim().min(1).max(200),
});
export type EditOrderInput = z.infer<typeof EditOrderInput>;

async function loadOrder(tx: Repositories, ctx: Ctx, id: string): Promise<Order> {
  const order = await tx.orders.get(id);
  if (!order || order.brandId !== ctx.actor.brandId)
    throw new AppError('NOT_FOUND', 'Order not found');
  assertLocation(ctx, order.locationId);
  return order;
}

/** Changes an unpaid order (wrong plate, extra add-on). Re-priced on the server and audited. */
export async function editOrder(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  input: EditOrderInput,
): Promise<Order> {
  const order = await loadOrder(tx, ctx, id);
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new AppError(
      'ORDER_NOT_EDITABLE',
      'Paid or cancelled orders cannot be edited; refund instead',
    );
  }
  const patch: Partial<Order> = {};
  if (input.plate !== undefined && plateKey(input.plate) !== order.plateKey) {
    // Move the visit from the mistyped plate to the right one.
    const old = await tx.vehicles.get(vehicleId(ctx.actor.brandId, order.plateKey));
    if (old) await tx.vehicles.update(old.id, { visitCount: Math.max(0, old.visitCount - 1) });
    const visit = await recordVisit(tx, ctx, {
      plate: input.plate,
      customerName: input.customerName ?? order.customerName,
      customerPhone: input.customerPhone ?? order.customerPhone,
      vehicleClassCode: order.lines.find((l) => l.kind === 'vehicleClass')?.code ?? null,
    });
    patch.plateKey = visit.vehicle.plateKey;
    patch.plateDisplay = visit.vehicle.plateDisplay;
    patch.returning = visit.returning;
    patch.customerId = visit.customer?.id ?? order.customerId;
  } else if (input.plate !== undefined) {
    patch.plateDisplay = plateDisplay(input.plate);
  }
  if (input.customerName !== undefined) patch.customerName = input.customerName || null;
  if (input.customerPhone !== undefined) patch.customerPhone = normalizePhone(input.customerPhone);
  if (input.lines) {
    try {
      const priced = priceOrder(
        await loadCatalog(tx, ctx.actor.brandId, order.locationId),
        input.lines,
      );
      Object.assign(patch, {
        lines: priced.lines,
        subtotalCents: priced.subtotalCents,
        totalCents: priced.totalCents,
      });
    } catch (e) {
      asAppError(e);
    }
  }
  const at = ctx.now.toISOString();
  const updated = await tx.orders.update(order.id, {
    ...patch,
    updatedAt: at,
    updatedBy: ctx.actor.id,
  });
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, order[k as keyof Order]]));
  await audit(tx, ctx, {
    action: 'order.update',
    entity: 'order',
    entityId: order.id,
    locationId: order.locationId,
    before,
    after: patch,
    reason: input.reason,
  });
  return updated;
}

/**
 * Refunds a paid order in full: appends a reversing payment for each original payment (same method,
 * negative amount) in the currently open shift, so the drawer and reports stay correct. Nothing is
 * edited or deleted; the order is marked CANCELLED with the reason.
 */
export async function refundOrder(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  reason: string,
): Promise<{ order: Order; reversals: Payment[] }> {
  const order = await loadOrder(tx, ctx, id);
  if (order.status !== 'COMPLETED')
    throw new AppError('ORDER_NOT_EDITABLE', 'Only paid orders can be refunded');
  const location = await tx.locations.get(order.locationId);
  const shift = location?.openShiftId ? await tx.shifts.get(location.openShiftId) : null;
  if (!shift || shift.status !== 'OPEN')
    throw new AppError('SHIFT_NOT_OPEN', 'Open a shift to give a refund');

  const payments = await tx.payments.find({
    where: [eq('brandId', ctx.actor.brandId), eq('orderId', order.id)],
  });
  const reversed = new Set(payments.map((p) => p.reversesId).filter(Boolean));
  const originals = payments.filter((p) => p.amountCents > 0 && !reversed.has(p.id));
  if (!originals.length) throw new AppError('ALREADY_REVERSED', 'This order was already refunded');

  const day = businessDate(
    ctx.now,
    await locationTimezone(tx, ctx.actor.brandId, order.locationId),
  );
  const at = ctx.now.toISOString();
  const reversals: Payment[] = [];
  for (const p of originals) {
    reversals.push(
      await tx.payments.insert({
        ...p,
        id: newId(ctx.now),
        createdAt: at,
        createdBy: ctx.actor.id,
        shiftId: shift.id,
        businessDate: day,
        amountCents: -p.amountCents,
        reversesId: p.id,
        reason,
      }),
    );
  }
  const refunded = originals.reduce((s, p) => s + p.amountCents, 0);
  const updated = await tx.orders.update(order.id, {
    status: 'CANCELLED',
    paidCents: order.paidCents - refunded,
    cancelReason: reason,
    statusHistory: [...order.statusHistory, { status: 'CANCELLED', at, by: ctx.actor.id }],
    updatedAt: at,
    updatedBy: ctx.actor.id,
  });
  const vehicle = await tx.vehicles.get(vehicleId(ctx.actor.brandId, order.plateKey));
  if (vehicle) {
    await tx.vehicles.update(vehicle.id, {
      completedVisits: Math.max(0, vehicle.completedVisits - 1),
      totalSpentCents: Math.max(0, vehicle.totalSpentCents - order.totalCents),
      updatedAt: at,
    });
  }
  if (order.customerId) {
    const c = await tx.customers.get(order.customerId);
    if (c)
      await tx.customers.update(c.id, {
        totalSpentCents: Math.max(0, c.totalSpentCents - order.totalCents),
        updatedAt: at,
      });
  }
  await audit(tx, ctx, {
    action: 'order.refund',
    entity: 'order',
    entityId: order.id,
    locationId: order.locationId,
    before: { status: order.status, paidCents: order.paidCents },
    after: {
      status: 'CANCELLED',
      paidCents: updated.paidCents,
      reversals: reversals.map((r) => r.id),
    },
    reason,
  });
  return { order: updated, reversals };
}

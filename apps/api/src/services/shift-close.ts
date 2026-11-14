import {
  DenominationCountField,
  denominationTotal,
  formatLKR,
  reconcile,
  varianceAlertMessage,
  whatsappAlerts,
  type Employee,
  type Reconciliation,
  type Shift,
  type ShiftClose,
  type WhatsappAlert,
} from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { assertLocation } from '../lib/guard';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { getSettings } from './config';

const PinRef = z.object({ employeeId: z.string().min(1), pin: z.string().regex(/^\d{4,6}$/) });

export const CloseShiftInput = z.object({
  closingCount: DenominationCountField,
  notes: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => v || null),
  handover: PinRef,
  override: PinRef.nullish(),
});
export type CloseShiftInput = z.infer<typeof CloseShiftInput>;

export interface ShiftSummary {
  shift: Shift;
  reconciliation: Reconciliation;
  vehicleCount: number;
  openOrders: number;
}

export async function loadShift(
  repos: Pick<Repositories, 'shifts'>,
  ctx: Ctx,
  id: string,
): Promise<Shift> {
  const shift = await repos.shifts.get(id);
  if (!shift || shift.brandId !== ctx.actor.brandId)
    throw new AppError('NOT_FOUND', 'Shift not found');
  assertLocation(ctx, shift.locationId);
  return shift;
}

/** System totals for a shift (and the variance once a count is given). */
export async function shiftSummary(
  repos: Repositories,
  ctx: Ctx,
  id: string,
  countedCents: number | null = null,
): Promise<ShiftSummary> {
  const shift = await loadShift(repos, ctx, id);
  const brand = eq<{ brandId: string }>('brandId', ctx.actor.brandId);
  const [payments, cashMovements, orders, settings] = await Promise.all([
    repos.payments.find({ where: [brand, eq('shiftId', id)] }),
    repos.cashMovements.find({ where: [brand, eq('shiftId', id)] }),
    repos.orders.find({ where: [brand, eq('locationId', shift.locationId)] }),
    getSettings(repos, ctx.actor.brandId, shift.locationId),
  ]);
  return {
    shift,
    reconciliation: reconcile({
      openingCents: shift.openingCents,
      payments,
      cashMovements,
      countedCents,
      thresholds: settings.variance,
    }),
    vehicleCount: orders.filter((o) => o.shiftId === id && o.status === 'COMPLETED').length,
    openOrders: orders.filter((o) => ['QUEUED', 'IN_PROGRESS', 'READY'].includes(o.status)).length,
  };
}

export interface CloseResult {
  close: ShiftClose;
  reconciliation: Reconciliation;
  whatsapp: WhatsappAlert[];
}

/**
 * Closes a shift. `handover` and `override` are employees already verified outside the
 * transaction (D-034); this function enforces when each is required.
 */
export async function closeShift(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  input: CloseShiftInput,
  handover: Employee,
  override: Employee | null,
): Promise<CloseResult> {
  const shift = await loadShift(tx, ctx, id);
  if (shift.status !== 'OPEN')
    throw new AppError('SHIFT_NOT_CLOSABLE', 'This shift is already closed');
  const settings = await getSettings(tx, ctx.actor.brandId, shift.locationId);
  let counted: number;
  try {
    counted = denominationTotal(settings.denominations, input.closingCount);
  } catch (e) {
    throw new AppError('VALIDATION_FAILED', (e as Error).message);
  }
  const { reconciliation: r, vehicleCount } = await shiftSummary(tx, ctx, id, counted);
  if (r.needsExplanation && !input.notes) {
    throw new AppError('VARIANCE_EXPLANATION_REQUIRED', 'Explain the variance before closing', {
      varianceCents: r.varianceCents,
    });
  }
  if (r.needsOverride && !override) {
    throw new AppError('OVERRIDE_REQUIRED', 'A manager must approve this variance', {
      varianceCents: r.varianceCents,
    });
  }
  const at = ctx.now.toISOString();
  const close: ShiftClose = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    locationId: shift.locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    shiftId: id,
    kind: 'CLOSE',
    adjustsId: null,
    openingCents: r.openingCents,
    cashSalesCents: r.cashSalesCents,
    cardSalesCents: r.cardSalesCents,
    otherSalesCents: r.otherSalesCents,
    expensesCents: r.expensesCents,
    depositsCents: r.depositsCents,
    expectedCents: r.expectedCents,
    countedCents: counted,
    varianceCents: r.varianceCents ?? 0,
    closingCount: input.closingCount,
    vehicleCount,
    notes: input.notes,
    overrideByEmployeeId: override?.id ?? null,
    handoverEmployeeId: handover.id,
    handoverName: handover.name,
    reason: null,
  };
  await tx.shiftCloses.insert(close);
  await tx.shifts.update(id, {
    status: 'CLOSED',
    closeId: close.id,
    closedAt: at,
    updatedAt: at,
    updatedBy: ctx.actor.id,
  });
  await tx.locations.update(shift.locationId, { openShiftId: null });

  let whatsapp: WhatsappAlert[] = [];
  if (r.needsExplanation) {
    const label = `${shift.supervisorName}, ${shift.businessDate}`;
    const text = varianceAlertMessage(label, formatLKR(r.varianceCents ?? 0), at, input.notes);
    await tx.alerts.insert({
      id: newId(ctx.now),
      brandId: ctx.actor.brandId,
      locationId: shift.locationId,
      createdAt: at,
      createdBy: ctx.actor.id,
      kind: 'VARIANCE',
      severity: r.needsOverride ? 'danger' : 'warning',
      message: `Variance ${formatLKR(r.varianceCents ?? 0)} on ${label}`,
      refType: 'shift',
      refId: id,
      acknowledgedBy: [],
    });
    whatsapp = whatsappAlerts('variance', settings.notificationNumbers.variance, text);
  }
  await audit(tx, ctx, {
    action: 'shift.close',
    entity: 'shift',
    entityId: id,
    locationId: shift.locationId,
    before: { status: 'OPEN' },
    after: close,
  });
  return { close, reconciliation: r, whatsapp };
}

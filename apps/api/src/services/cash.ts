import {
  businessDate,
  CashMovementType,
  PositiveCents,
  type CashMovement,
  type Employee,
} from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { assertLocation } from '../lib/guard';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { getSettings } from './config';
import { locationTimezone } from './orders';

export const CashMovementInput = z.object({
  type: CashMovementType,
  categoryId: z.string().min(1),
  amountCents: PositiveCents,
  paidTo: z.string().trim().min(1).max(80),
  description: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => v || null),
  override: z
    .object({ employeeId: z.string().min(1), pin: z.string().regex(/^\d{4,6}$/) })
    .nullish(),
});
export type CashMovementInput = z.infer<typeof CashMovementInput>;

async function openShiftFor(tx: Repositories, brandId: string, locationId: string) {
  const location = await tx.locations.get(locationId);
  const shift = location?.openShiftId ? await tx.shifts.get(location.openShiftId) : null;
  if (!shift || shift.status !== 'OPEN' || shift.brandId !== brandId) {
    throw new AppError('SHIFT_NOT_OPEN', 'Start a shift before recording cash');
  }
  return shift;
}

/** Whether this amount needs a manager PIN (checked before the transaction, see ADR-0034). */
export async function needsCashApproval(
  repos: Repositories,
  brandId: string,
  locationId: string,
  amountCents: number,
) {
  const settings = await getSettings(repos, brandId, locationId);
  return amountCents > settings.cashOut.approvalAboveCents;
}

/** Records an expense or deposit against the open shift. Append-only. */
export async function recordCashMovement(
  tx: Repositories,
  ctx: Ctx,
  locationId: string,
  input: CashMovementInput,
  approver: Employee | null,
  /** Back-dated entry onto a closed, unapproved shift (managers only, checked by the route). */
  targetShiftId?: string,
): Promise<CashMovement> {
  const brandId = ctx.actor.brandId;
  const shift = targetShiftId
    ? await closedShiftFor(tx, brandId, locationId, targetShiftId)
    : await openShiftFor(tx, brandId, locationId);
  const category = await tx.cashCategories.get(input.categoryId);
  if (
    !category ||
    category.brandId !== brandId ||
    !category.active ||
    category.type !== input.type
  ) {
    throw new AppError('VALIDATION_FAILED', 'Choose a valid category for this type');
  }
  if ((await needsCashApproval(tx, brandId, locationId, input.amountCents)) && !approver) {
    throw new AppError('OVERRIDE_REQUIRED', 'A manager needs to approve this amount');
  }
  const at = ctx.now.toISOString();
  const movement: CashMovement = {
    id: newId(ctx.now),
    brandId,
    locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    shiftId: shift.id,
    businessDate: targetShiftId
      ? shift.businessDate
      : businessDate(ctx.now, await locationTimezone(tx, brandId, locationId)),
    type: input.type,
    categoryId: category.id,
    categoryCode: category.code,
    categoryName: category.name.en,
    amountCents: input.amountCents,
    paidTo: input.paidTo,
    description: input.description,
    approvedByEmployeeId: approver?.id ?? null,
    reversesId: null,
    reason: null,
    backdated: !!targetShiftId,
  };
  await tx.cashMovements.insert(movement);
  await audit(tx, ctx, {
    action: `cash.${input.type.toLowerCase()}`,
    entity: 'cashMovement',
    entityId: movement.id,
    locationId,
    after: movement,
  });
  return movement;
}

/** Undo a cash entry by appending its negative in the current open shift. */
export async function reverseCashMovement(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  reason: string,
): Promise<CashMovement> {
  const original = await tx.cashMovements.get(id);
  if (!original || original.brandId !== ctx.actor.brandId)
    throw new AppError('NOT_FOUND', 'Entry not found');
  assertLocation(ctx, original.locationId);
  if (original.reversesId) throw new AppError('VALIDATION_FAILED', 'A reversal cannot be reversed');
  const existing = await tx.cashMovements.find({
    where: [eq('brandId', ctx.actor.brandId), eq('reversesId', id)],
    limit: 1,
  });
  if (existing.length) throw new AppError('ALREADY_REVERSED', 'This entry was already reversed');
  const shift = await openShiftFor(tx, ctx.actor.brandId, original.locationId);
  const at = ctx.now.toISOString();
  const reversal: CashMovement = {
    ...original,
    id: newId(ctx.now),
    createdAt: at,
    createdBy: ctx.actor.id,
    shiftId: shift.id,
    businessDate: businessDate(
      ctx.now,
      await locationTimezone(tx, ctx.actor.brandId, original.locationId),
    ),
    amountCents: -original.amountCents,
    approvedByEmployeeId: null,
    reversesId: original.id,
    reason,
  };
  await tx.cashMovements.insert(reversal);
  await audit(tx, ctx, {
    action: 'cash.reverse',
    entity: 'cashMovement',
    entityId: original.id,
    locationId: original.locationId,
    after: reversal,
    reason,
  });
  return reversal;
}

export async function listCashMovements(
  repos: Pick<Repositories, 'cashMovements'>,
  brandId: string,
  shiftId: string,
) {
  return repos.cashMovements.find({
    where: [eq('brandId', brandId), eq('shiftId', shiftId)],
    orderBy: { field: 'createdAt', dir: 'desc' },
  });
}

async function closedShiftFor(
  tx: Repositories,
  brandId: string,
  locationId: string,
  shiftId: string,
) {
  const shift = await tx.shifts.get(shiftId);
  if (!shift || shift.brandId !== brandId || shift.locationId !== locationId) {
    throw new AppError('NOT_FOUND', 'Shift not found');
  }
  if (shift.status !== 'CLOSED' && shift.status !== 'QUERIED') {
    throw new AppError(
      'CONFLICT',
      'Back-dated entries go on closed shifts that are not yet approved',
    );
  }
  return shift;
}

import {
  businessDate,
  DenominationCountField,
  denominationTotal,
  NonNegativeCents,
  type Shift,
  type ShiftClose,
} from '@stopwash/shared';
import { getSettings } from './config';
import { locationTimezone } from './orders';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { loadShift, shiftSummary } from './shift-close';

export interface HistoryRow {
  shift: Shift;
  close: ShiftClose | null;
  /** Latest figures: the newest ADJUSTMENT if any, else the CLOSE. */
  latest: ShiftClose | null;
}

/** Shift history (SWOMS "session history"), newest first. */
export async function listShifts(
  repos: Pick<Repositories, 'shifts' | 'shiftCloses'>,
  ctx: Ctx,
  locationId: string,
  page = 1,
  pageSize = 20,
) {
  const brand = eq<{ brandId: string }>('brandId', ctx.actor.brandId);
  const where = [brand, eq<Shift>('locationId', locationId)];
  const [shifts, total] = await Promise.all([
    repos.shifts.find({
      where,
      orderBy: { field: 'openedAt', dir: 'desc' },
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    repos.shifts.count({ where }),
  ]);
  const items: HistoryRow[] = await Promise.all(
    shifts.map(async (shift) => {
      const closes = await repos.shiftCloses.find({
        where: [brand, eq('shiftId', shift.id)],
        orderBy: { field: 'createdAt' },
      });
      return {
        shift,
        close: closes.find((c) => c.kind === 'CLOSE') ?? null,
        latest: closes.at(-1) ?? null,
      };
    }),
  );
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export const AdjustInput = z.object({
  /** Corrected physical count, if the original count was wrong. */
  countedCents: NonNegativeCents.optional(),
  reason: z.string().trim().min(3).max(500),
});
export type AdjustInput = z.infer<typeof AdjustInput>;

/**
 * Corrects a closed shift without editing anything: appends an ADJUSTMENT close record with the
 * reconciliation recomputed from the ledger (which may now include back-dated cash entries and
 * refunds) and, optionally, a corrected count. Approved shifts are locked.
 */
export async function adjustShift(
  tx: Repositories,
  ctx: Ctx,
  shiftId: string,
  input: AdjustInput,
): Promise<ShiftClose> {
  const shift = await loadShift(tx, ctx, shiftId);
  if (shift.status === 'OPEN') throw new AppError('CONFLICT', 'Close the shift first');
  if (shift.status === 'APPROVED') throw new AppError('CONFLICT', 'Approved shifts are locked');
  const brand = eq<{ brandId: string }>('brandId', ctx.actor.brandId);
  const closes = await tx.shiftCloses.find({
    where: [brand, eq('shiftId', shiftId)],
    orderBy: { field: 'createdAt' },
  });
  const original = closes.find((c) => c.kind === 'CLOSE');
  const previous = closes.at(-1);
  if (!original || !previous) throw new AppError('CONFLICT', 'This shift has no close record');
  const counted = input.countedCents ?? previous.countedCents;
  const { reconciliation: r, vehicleCount } = await shiftSummary(tx, ctx, shiftId, counted);
  const at = ctx.now.toISOString();
  const adj: ShiftClose = {
    ...original,
    id: newId(ctx.now),
    createdAt: at,
    createdBy: ctx.actor.id,
    kind: 'ADJUSTMENT',
    adjustsId: previous.id,
    cashSalesCents: r.cashSalesCents,
    cardSalesCents: r.cardSalesCents,
    otherSalesCents: r.otherSalesCents,
    expensesCents: r.expensesCents,
    depositsCents: r.depositsCents,
    expectedCents: r.expectedCents,
    countedCents: counted,
    varianceCents: r.varianceCents ?? 0,
    vehicleCount,
    reason: input.reason,
  };
  await tx.shiftCloses.insert(adj);
  if (shift.status === 'QUERIED')
    await tx.shifts.update(shiftId, { status: 'CLOSED', updatedAt: at, updatedBy: ctx.actor.id });
  await audit(tx, ctx, {
    action: 'shift.adjust',
    entity: 'shift',
    entityId: shiftId,
    locationId: shift.locationId,
    before: {
      expectedCents: previous.expectedCents,
      countedCents: previous.countedCents,
      varianceCents: previous.varianceCents,
    },
    after: {
      expectedCents: adj.expectedCents,
      countedCents: adj.countedCents,
      varianceCents: adj.varianceCents,
    },
    reason: input.reason,
  });
  return adj;
}

export const BackdatedShiftInput = z
  .object({
    supervisorEmployeeId: z.string().min(1),
    openedAt: z.iso.datetime({ offset: true }),
    closedAt: z.iso.datetime({ offset: true }),
    openingCount: DenominationCountField,
    closingCount: DenominationCountField,
    reason: z.string().trim().min(3).max(500),
  })
  .refine((v) => v.closedAt > v.openedAt, {
    message: 'Close must be after open',
    path: ['closedAt'],
  });
export type BackdatedShiftInput = z.infer<typeof BackdatedShiftInput>;

/**
 * Owner-only record of a past shift (SWOMS "manual session"), e.g. when the system was down.
 * Created already closed; cash entries can then be back-dated onto it and an adjustment run.
 */
export async function createBackdatedShift(
  tx: Repositories,
  ctx: Ctx,
  locationId: string,
  input: BackdatedShiftInput,
): Promise<Shift> {
  if (ctx.actor.role !== 'owner')
    throw new AppError('FORBIDDEN', 'Only the owner can add past shifts');
  if (new Date(input.closedAt) > ctx.now)
    throw new AppError('VALIDATION_FAILED', 'Past shifts must end in the past');
  const supervisor = await tx.employees.get(input.supervisorEmployeeId);
  if (!supervisor || supervisor.brandId !== ctx.actor.brandId)
    throw new AppError('VALIDATION_FAILED', 'Unknown supervisor');
  const settings = await getSettings(tx, ctx.actor.brandId, locationId);
  const tz = await locationTimezone(tx, ctx.actor.brandId, locationId);
  const opening = denominationTotal(settings.denominations, input.openingCount);
  const counted = denominationTotal(settings.denominations, input.closingCount);
  const at = ctx.now.toISOString();
  const shift: Shift = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    updatedAt: null,
    updatedBy: null,
    status: 'CLOSED',
    supervisorEmployeeId: supervisor.id,
    supervisorName: supervisor.name,
    openedAt: input.openedAt,
    businessDate: businessDate(new Date(input.openedAt), tz),
    checklistId: null,
    openingCount: input.openingCount,
    openingCents: opening,
    carryoverNotes: null,
    closeId: null,
    closedAt: input.closedAt,
    approvalId: null,
    backdated: true,
  };
  const close: ShiftClose = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    shiftId: shift.id,
    kind: 'CLOSE',
    adjustsId: null,
    openingCents: opening,
    cashSalesCents: 0,
    cardSalesCents: 0,
    otherSalesCents: 0,
    expensesCents: 0,
    depositsCents: 0,
    expectedCents: opening,
    countedCents: counted,
    varianceCents: counted - opening,
    closingCount: input.closingCount,
    vehicleCount: 0,
    notes: input.reason,
    overrideByEmployeeId: null,
    handoverEmployeeId: null,
    handoverName: null,
    reason: input.reason,
  };
  await tx.shifts.insert({ ...shift, closeId: close.id });
  await tx.shiftCloses.insert(close);
  await audit(tx, ctx, {
    action: 'shift.backdate',
    entity: 'shift',
    entityId: shift.id,
    locationId,
    after: { shift, close },
    reason: input.reason,
  });
  return { ...shift, closeId: close.id };
}

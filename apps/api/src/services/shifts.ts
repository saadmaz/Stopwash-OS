import {
  businessDate,
  DenominationCountField,
  denominationTotal,
  type Shift,
} from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import type { Repositories } from '../repos';
import { audit } from './audit';
import { getSettings } from './config';
import { locationTimezone } from './orders';

export const OpenShiftInput = z.object({
  supervisorEmployeeId: z.string().min(1),
  checklistId: z
    .string()
    .min(1)
    .nullish()
    .transform((v) => v ?? null),
  openingCount: DenominationCountField,
  carryoverNotes: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
});
export type OpenShiftInput = z.infer<typeof OpenShiftInput>;

export async function openShift(
  tx: Repositories,
  ctx: Ctx,
  locationId: string,
  input: OpenShiftInput,
): Promise<Shift> {
  const brandId = ctx.actor.brandId;
  const location = await tx.locations.get(locationId);
  if (!location || location.brandId !== brandId)
    throw new AppError('NOT_FOUND', 'Unknown location');
  if (location.openShiftId) {
    throw new AppError('SHIFT_ALREADY_OPEN', 'A shift is already open here', {
      shiftId: location.openShiftId,
    });
  }
  const supervisor = await tx.employees.get(input.supervisorEmployeeId);
  if (
    !supervisor ||
    !supervisor.active ||
    supervisor.brandId !== brandId ||
    !supervisor.locationIds.includes(locationId) ||
    !(
      supervisor.canOpenShift ||
      supervisor.systemRole === 'manager' ||
      supervisor.systemRole === 'owner'
    )
  ) {
    throw new AppError('VALIDATION_FAILED', 'Choose a supervisor who can open shifts');
  }
  if (input.checklistId) {
    const chk = await tx.checklists.get(input.checklistId);
    if (
      !chk ||
      chk.brandId !== brandId ||
      chk.locationId !== locationId ||
      chk.kind !== 'PRE_SHIFT'
    ) {
      throw new AppError('VALIDATION_FAILED', 'Unknown checklist');
    }
  }
  const settings = await getSettings(tx, brandId, locationId);
  let openingCents: number;
  try {
    openingCents = denominationTotal(settings.denominations, input.openingCount);
  } catch (e) {
    throw new AppError('VALIDATION_FAILED', (e as Error).message);
  }
  const at = ctx.now.toISOString();
  const shift: Shift = {
    id: newId(ctx.now),
    brandId,
    locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    updatedAt: null,
    updatedBy: null,
    status: 'OPEN',
    supervisorEmployeeId: supervisor.id,
    supervisorName: supervisor.name,
    openedAt: at,
    businessDate: businessDate(ctx.now, await locationTimezone(tx, brandId, locationId)),
    checklistId: input.checklistId,
    openingCount: input.openingCount,
    openingCents,
    carryoverNotes: input.carryoverNotes,
    closeId: null,
    closedAt: null,
    approvalId: null,
    backdated: false,
  };
  await tx.shifts.insert(shift);
  await tx.locations.update(locationId, { openShiftId: shift.id });
  await audit(tx, ctx, {
    action: 'shift.open',
    entity: 'shift',
    entityId: shift.id,
    locationId,
    after: shift,
  });
  return shift;
}

export async function currentShift(
  repos: Pick<Repositories, 'locations' | 'shifts'>,
  brandId: string,
  locationId: string,
): Promise<Shift | null> {
  const location = await repos.locations.get(locationId);
  if (!location || location.brandId !== brandId || !location.openShiftId) return null;
  return repos.shifts.get(location.openShiftId);
}

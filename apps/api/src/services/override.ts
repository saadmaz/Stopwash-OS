import { can, type Employee, type Permission } from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import type { Repositories } from '../repos';
import { verifyPin, type PinPolicy } from './pin';

export interface OverrideInput {
  employeeId: string;
  pin: string;
}

/**
 * Manager step-up for one action (big discount, large variance, cash-out approval, handover).
 * The approver must be active at this location, hold `permission`, and enter their own PIN.
 * Nothing is remembered: every action asks again.
 */
export async function verifyOverride(
  tx: Pick<Repositories, 'employees' | 'employeeSecrets'>,
  ctx: Ctx,
  locationId: string,
  override: OverrideInput | null | undefined,
  permission: Permission,
  policy: PinPolicy,
): Promise<Employee> {
  if (!override) throw new AppError('OVERRIDE_REQUIRED', 'A manager needs to approve this');
  const approver = await tx.employees.get(override.employeeId);
  const eligible =
    approver &&
    approver.active &&
    approver.brandId === ctx.actor.brandId &&
    approver.locationIds.includes(locationId) &&
    can(approver.systemRole, permission);
  try {
    await verifyPin(
      tx,
      ctx.actor.brandId,
      eligible ? approver.id : `none:${override.employeeId}`,
      override.pin,
      ctx.now,
      policy,
    );
  } catch (e) {
    if (e instanceof AppError && e.code === 'PIN_LOCKED') throw e;
    throw new AppError('OVERRIDE_INVALID', 'Approval PIN is incorrect');
  }
  if (!eligible) throw new AppError('OVERRIDE_INVALID', 'This person cannot approve it');
  return approver;
}

import { EmployeeInput, PeriodKeyField, Pin, type Employee } from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { setPin } from './pin';

export const CreateEmployeeInput = EmployeeInput.extend({ pin: Pin.nullish() });
export const UpdateEmployeeInput = EmployeeInput.partial().extend({
  active: z.boolean().optional(),
});
export const ExemptInput = z.object({ period: PeriodKeyField, exempt: z.boolean() });

async function load(tx: Pick<Repositories, 'employees'>, ctx: Ctx, id: string): Promise<Employee> {
  const e = await tx.employees.get(id);
  if (!e || e.brandId !== ctx.actor.brandId) throw new AppError('NOT_FOUND', 'Employee not found');
  return e;
}

/** Only owners can create other owners; managers manage cashiers and accounts. */
function assertRoleAllowed(ctx: Ctx, role: Employee['systemRole'] | undefined) {
  if (!role) return;
  if ((role === 'owner' || role === 'manager') && ctx.actor.role !== 'owner') {
    throw new AppError('FORBIDDEN', 'Only the owner can give manager or owner access');
  }
}

export async function listEmployees(
  repos: Pick<Repositories, 'employees'>,
  ctx: Ctx,
  includeInactive: boolean,
) {
  const where = [eq<Employee>('brandId', ctx.actor.brandId)];
  if (!includeInactive) where.push(eq('active', true));
  return repos.employees.find({ where, orderBy: { field: 'name' } });
}

export async function createEmployee(
  tx: Repositories,
  ctx: Ctx,
  input: z.infer<typeof CreateEmployeeInput>,
): Promise<Employee> {
  assertRoleAllowed(ctx, input.systemRole);
  const dup = await tx.employees.find({
    where: [eq('brandId', ctx.actor.brandId), eq('code', input.code)],
    limit: 1,
  });
  if (dup.length) throw new AppError('CONFLICT', `Employee code ${input.code} is already used`);
  const { pin, ...rest } = input;
  const at = ctx.now.toISOString();
  const employee: Employee = {
    ...rest,
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    createdAt: at,
    createdBy: ctx.actor.id,
    updatedAt: null,
    updatedBy: null,
    exemptMonths: [],
    active: true,
    hasPin: !!pin,
  };
  await tx.employees.insert(employee);
  if (pin) await setPin(tx, ctx.actor.brandId, employee.id, pin, ctx.now);
  await audit(tx, ctx, {
    action: 'employee.create',
    entity: 'employee',
    entityId: employee.id,
    after: employee,
  });
  return employee;
}

export async function updateEmployee(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  patch: z.infer<typeof UpdateEmployeeInput>,
): Promise<Employee> {
  const before = await load(tx, ctx, id);
  assertRoleAllowed(ctx, patch.systemRole);
  assertRoleAllowed(
    ctx,
    before.systemRole === 'owner' || before.systemRole === 'manager'
      ? before.systemRole
      : undefined,
  );
  if (patch.code && patch.code !== before.code) {
    const dup = await tx.employees.find({
      where: [eq('brandId', ctx.actor.brandId), eq('code', patch.code)],
      limit: 1,
    });
    if (dup.length) throw new AppError('CONFLICT', `Employee code ${patch.code} is already used`);
  }
  if (patch.active === false && ctx.actor.employeeId === id) {
    throw new AppError('CONFLICT', 'You cannot deactivate yourself');
  }
  const after = await tx.employees.update(id, {
    ...patch,
    updatedAt: ctx.now.toISOString(),
    updatedBy: ctx.actor.id,
  });
  const changed = Object.keys(patch) as (keyof Employee)[];
  await audit(tx, ctx, {
    action: patch.active === false ? 'employee.deactivate' : 'employee.update',
    entity: 'employee',
    entityId: id,
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: patch,
  });
  return after;
}

export async function resetPin(tx: Repositories, ctx: Ctx, id: string, pin: string): Promise<void> {
  const e = await load(tx, ctx, id);
  assertRoleAllowed(
    ctx,
    e.systemRole === 'owner' || e.systemRole === 'manager' ? e.systemRole : undefined,
  );
  await setPin(tx, ctx.actor.brandId, id, pin, ctx.now);
  if (!e.hasPin) await tx.employees.update(id, { hasPin: true });
  await audit(tx, ctx, { action: 'employee.pinReset', entity: 'employee', entityId: id });
}

/** SWOMS "skip recurring adjustments" for one pay period. */
export async function setExempt(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  input: z.infer<typeof ExemptInput>,
): Promise<Employee> {
  const e = await load(tx, ctx, id);
  const months = new Set(e.exemptMonths);
  if (input.exempt) months.add(input.period);
  else months.delete(input.period);
  const after = await tx.employees.update(id, {
    exemptMonths: [...months].sort(),
    updatedAt: ctx.now.toISOString(),
    updatedBy: ctx.actor.id,
  });
  await audit(tx, ctx, {
    action: 'employee.exempt',
    entity: 'employee',
    entityId: id,
    before: { exemptMonths: e.exemptMonths },
    after: { exemptMonths: after.exemptMonths },
  });
  return after;
}

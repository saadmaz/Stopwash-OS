import {
  CentsField,
  DateKeyField,
  DEDUCTION_CATEGORIES,
  periodOf,
  type PayrollAdjustment,
} from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';

export const AdjustmentInput = z
  .object({
    employeeId: z.string().min(1),
    date: DateKeyField,
    kind: z.enum(['DEDUCTION', 'BONUS']),
    category: z.string().trim().min(1).max(30),
    /** Deductions are positive amounts taken off; bonus adjustments may be negative (SWOMS ±). */
    amountCents: CentsField.refine((v) => v !== 0, 'Amount cannot be zero'),
    reason: z.string().trim().min(1).max(200),
  })
  .refine((v) => v.kind === 'BONUS' || v.amountCents > 0, {
    message: 'Deductions must be positive',
    path: ['amountCents'],
  })
  .refine(
    (v) => v.kind === 'BONUS' || (DEDUCTION_CATEGORIES as readonly string[]).includes(v.category),
    { message: 'Unknown deduction category', path: ['category'] },
  );
export type AdjustmentInput = z.infer<typeof AdjustmentInput>;

export async function isFinalized(
  repos: Pick<Repositories, 'payrollRuns'>,
  brandId: string,
  period: string,
): Promise<boolean> {
  const runs = await repos.payrollRuns.find({
    where: [eq('brandId', brandId), eq('period', period), eq('kind', 'REGULAR')],
    limit: 1,
  });
  return runs.length > 0;
}

export async function addAdjustment(
  tx: Repositories,
  ctx: Ctx,
  input: AdjustmentInput,
): Promise<PayrollAdjustment> {
  const employee = await tx.employees.get(input.employeeId);
  if (!employee || employee.brandId !== ctx.actor.brandId) {
    throw new AppError('NOT_FOUND', 'Employee not found');
  }
  const period = periodOf(input.date);
  if (await isFinalized(tx, ctx.actor.brandId, period)) {
    throw new AppError('PERIOD_ALREADY_FINALIZED', `Payroll for ${period} is finalized`);
  }
  const at = ctx.now.toISOString();
  const adj: PayrollAdjustment = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    createdAt: at,
    createdBy: ctx.actor.id,
    employeeId: employee.id,
    period,
    date: input.date,
    kind: input.kind,
    category: input.category,
    amountCents: input.amountCents,
    reason: input.reason,
    reversesId: null,
  };
  await tx.payrollAdjustments.insert(adj);
  await audit(tx, ctx, {
    action: `payroll.${input.kind === 'DEDUCTION' ? 'deduction' : 'bonusAdjustment'}`,
    entity: 'employee',
    entityId: employee.id,
    after: adj,
    reason: input.reason,
  });
  return adj;
}

export async function reverseAdjustment(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  reason: string,
): Promise<PayrollAdjustment> {
  const original = await tx.payrollAdjustments.get(id);
  if (!original || original.brandId !== ctx.actor.brandId) {
    throw new AppError('NOT_FOUND', 'Entry not found');
  }
  if (original.reversesId) throw new AppError('VALIDATION_FAILED', 'A reversal cannot be reversed');
  const done = await tx.payrollAdjustments.find({
    where: [eq('brandId', ctx.actor.brandId), eq('reversesId', id)],
    limit: 1,
  });
  if (done.length) throw new AppError('ALREADY_REVERSED', 'Already reversed');
  if (await isFinalized(tx, ctx.actor.brandId, original.period)) {
    throw new AppError('PERIOD_ALREADY_FINALIZED', `Payroll for ${original.period} is finalized`);
  }
  const at = ctx.now.toISOString();
  const reversal: PayrollAdjustment = {
    ...original,
    id: newId(ctx.now),
    createdAt: at,
    createdBy: ctx.actor.id,
    amountCents: -original.amountCents,
    reason,
    reversesId: original.id,
  };
  await tx.payrollAdjustments.insert(reversal);
  await audit(tx, ctx, {
    action: 'payroll.adjustmentReverse',
    entity: 'employee',
    entityId: original.employeeId,
    after: reversal,
    reason,
  });
  return reversal;
}

export async function listAdjustments(
  repos: Pick<Repositories, 'payrollAdjustments'>,
  brandId: string,
  period: string,
  employeeId?: string,
) {
  const where = [
    eq<PayrollAdjustment>('brandId', brandId),
    eq<PayrollAdjustment>('period', period),
  ];
  if (employeeId) where.push(eq('employeeId', employeeId));
  return repos.payrollAdjustments.find({ where, orderBy: { field: 'createdAt' } });
}

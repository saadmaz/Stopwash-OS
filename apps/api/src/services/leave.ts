import {
  can,
  dateRange,
  diffDays,
  type LeaveInput,
  type Attendance,
  type Leave,
} from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';

export const LeaveDecision = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(200).nullish(),
});

const isSelf = (ctx: Ctx, employeeId: string) => ctx.actor.employeeId === employeeId;

export async function requestLeave(
  tx: Repositories,
  ctx: Ctx,
  input: z.infer<typeof LeaveInput>,
): Promise<Leave> {
  if (!isSelf(ctx, input.employeeId) && !can(ctx.actor.role, 'leave.read.all')) {
    throw new AppError('FORBIDDEN', 'You can only request leave for yourself');
  }
  const employee = await tx.employees.get(input.employeeId);
  if (!employee || employee.brandId !== ctx.actor.brandId) {
    throw new AppError('NOT_FOUND', 'Employee not found');
  }
  const at = ctx.now.toISOString();
  const leave: Leave = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    createdAt: at,
    createdBy: ctx.actor.id,
    employeeId: employee.id,
    employeeName: employee.name,
    startDate: input.startDate,
    endDate: input.endDate,
    days: diffDays(input.startDate, input.endDate) + 1,
    reason: input.reason,
    status: 'PENDING',
    processedBy: null,
    processedAt: null,
  };
  await tx.leaves.insert(leave);
  await audit(tx, ctx, {
    action: 'leave.request',
    entity: 'leave',
    entityId: leave.id,
    after: leave,
  });
  return leave;
}

export async function listLeaves(repos: Pick<Repositories, 'leaves'>, ctx: Ctx) {
  const where = [eq<Leave>('brandId', ctx.actor.brandId)];
  if (!can(ctx.actor.role, 'leave.read.all'))
    where.push(eq('employeeId', ctx.actor.employeeId ?? '-'));
  return repos.leaves.find({ where, orderBy: { field: 'createdAt', dir: 'desc' }, limit: 200 });
}

async function loadPending(tx: Repositories, ctx: Ctx, id: string): Promise<Leave> {
  const leave = await tx.leaves.get(id);
  if (!leave || leave.brandId !== ctx.actor.brandId)
    throw new AppError('NOT_FOUND', 'Request not found');
  if (leave.status !== 'PENDING')
    throw new AppError('CONFLICT', 'This request was already processed');
  return leave;
}

/** Approve or reject. Approval marks each day as LEAVE in attendance (overwrites nothing else). */
export async function decideLeave(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  input: z.infer<typeof LeaveDecision>,
): Promise<Leave> {
  const leave = await loadPending(tx, ctx, id);
  if (isSelf(ctx, leave.employeeId))
    throw new AppError('FORBIDDEN', 'Someone else must approve your leave');
  const at = ctx.now.toISOString();
  const updated = await tx.leaves.update(id, {
    status: input.decision,
    processedBy: ctx.actor.id,
    processedAt: at,
  });
  if (input.decision === 'APPROVED') {
    const employee = await tx.employees.get(leave.employeeId);
    for (const date of dateRange(leave.startDate, leave.endDate)) {
      const record: Attendance = {
        id: `${leave.employeeId}__${date}`,
        brandId: ctx.actor.brandId,
        locationId: employee?.locationIds[0] ?? '',
        createdAt: at,
        createdBy: ctx.actor.id,
        updatedAt: at,
        updatedBy: ctx.actor.id,
        employeeId: leave.employeeId,
        date,
        status: 'LEAVE',
        clockInAt: null,
        clockOutAt: null,
        note: `Leave ${leave.id}`,
      };
      await tx.attendance.upsert(record);
    }
  }
  await audit(tx, ctx, {
    action: input.decision === 'APPROVED' ? 'leave.approve' : 'leave.reject',
    entity: 'leave',
    entityId: id,
    before: { status: 'PENDING' },
    after: { status: input.decision },
    reason: input.note ?? null,
  });
  return updated;
}

export async function cancelLeave(tx: Repositories, ctx: Ctx, id: string): Promise<Leave> {
  const leave = await loadPending(tx, ctx, id);
  if (!isSelf(ctx, leave.employeeId) && !can(ctx.actor.role, 'leave.approve')) {
    throw new AppError('FORBIDDEN', 'Only the requester or a manager can cancel');
  }
  const updated = await tx.leaves.update(id, {
    status: 'CANCELLED',
    processedBy: ctx.actor.id,
    processedAt: ctx.now.toISOString(),
  });
  await audit(tx, ctx, { action: 'leave.cancel', entity: 'leave', entityId: id });
  return updated;
}

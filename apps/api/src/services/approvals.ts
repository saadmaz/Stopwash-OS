import { sum, type Shift, type ShiftApproval, type ShiftClose } from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { loadShift } from './shift-close';

export const ApprovalInput = z.object({
  decision: z.enum(['APPROVED', 'QUERIED']),
  note: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
});
export type ApprovalInput = z.infer<typeof ApprovalInput>;

export interface ApprovalRow {
  shift: Shift;
  close: ShiftClose | null;
  approvals: ShiftApproval[];
}

/** The accounts queue: closed shifts (newest first) with KPIs over the ones not yet approved. */
export async function listApprovals(
  repos: Pick<Repositories, 'shifts' | 'shiftCloses' | 'shiftApprovals'>,
  ctx: Ctx,
  status: 'PENDING' | 'APPROVED' | 'ALL',
  locationId?: string,
) {
  const brand = eq<{ brandId: string }>('brandId', ctx.actor.brandId);
  const where = [
    brand,
    {
      field: 'status' as const,
      op: 'in' as const,
      value:
        status === 'PENDING'
          ? ['CLOSED', 'QUERIED']
          : status === 'APPROVED'
            ? ['APPROVED']
            : ['CLOSED', 'QUERIED', 'APPROVED'],
    },
  ];
  if (locationId) where.push(eq('locationId', locationId) as never);
  const shifts = (
    await repos.shifts.find({ where, orderBy: { field: 'closedAt', dir: 'desc' }, limit: 200 })
  ).filter((s) => ctx.actor.role === 'owner' || ctx.actor.locationIds.includes(s.locationId));
  const rows: ApprovalRow[] = await Promise.all(
    shifts.map(async (shift) => {
      const [closes, approvals] = await Promise.all([
        repos.shiftCloses.find({
          where: [brand, eq('shiftId', shift.id)],
          orderBy: { field: 'createdAt' },
        }),
        repos.shiftApprovals.find({
          where: [brand, eq('shiftId', shift.id)],
          orderBy: { field: 'createdAt' },
        }),
      ]);
      return { shift, close: closes.find((c) => c.kind === 'CLOSE') ?? null, approvals };
    }),
  );
  const pending = rows.filter((r) => r.shift.status !== 'APPROVED' && r.close);
  return {
    rows,
    kpis: {
      pendingCount: pending.length,
      expectedCents: sum(pending.map((r) => r.close!.expectedCents)),
      countedCents: sum(pending.map((r) => r.close!.countedCents)),
      expensesCents: sum(pending.map((r) => r.close!.expensesCents)),
      varianceCents: sum(pending.map((r) => r.close!.varianceCents)),
    },
  };
}

/** Accounts decision on a closed shift. Append-only; the shift status follows the latest decision. */
export async function decideShift(
  tx: Repositories,
  ctx: Ctx,
  shiftId: string,
  input: ApprovalInput,
): Promise<ShiftApproval> {
  const shift = await loadShift(tx, ctx, shiftId);
  if (shift.status !== 'CLOSED' && shift.status !== 'QUERIED') {
    throw new AppError(
      'CONFLICT',
      shift.status === 'OPEN' ? 'Close the shift first' : 'Already approved',
    );
  }
  if (input.decision === 'QUERIED' && !input.note) {
    throw new AppError('VALIDATION_FAILED', 'Say what needs checking');
  }
  const at = ctx.now.toISOString();
  const approval: ShiftApproval = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    locationId: shift.locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    shiftId,
    decision: input.decision,
    note: input.note,
  };
  await tx.shiftApprovals.insert(approval);
  await tx.shifts.update(shiftId, {
    status: input.decision,
    approvalId: approval.id,
    updatedAt: at,
    updatedBy: ctx.actor.id,
  });
  await audit(tx, ctx, {
    action: input.decision === 'APPROVED' ? 'shift.approve' : 'shift.query',
    entity: 'shift',
    entityId: shiftId,
    locationId: shift.locationId,
    before: { status: shift.status },
    after: { status: input.decision },
    reason: input.note,
  });
  return approval;
}

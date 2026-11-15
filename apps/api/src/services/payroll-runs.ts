import {
  computePayslip,
  isPeriodKey,
  payrollTotals,
  type AttendanceStatus,
  type PayrollRun,
  type PayslipLine,
} from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { getSettings } from './config';

/** Draft payslips for every active employee. Nothing is stored. */
export async function previewPayroll(repos: Repositories, ctx: Ctx, period: string) {
  if (!isPeriodKey(period)) throw new AppError('VALIDATION_FAILED', 'Period must be YYYY-MM');
  const brandId = ctx.actor.brandId;
  const brand = eq<{ brandId: string }>('brandId', brandId);
  const [employees, rules, orders, attendance, adjustments] = await Promise.all([
    repos.employees.find({ where: [brand, eq('active', true)], orderBy: { field: 'name' } }),
    repos.incentiveRules.find({ where: [brand] }),
    repos.orders.find({
      where: [
        brand,
        eq('status', 'COMPLETED'),
        { field: 'businessDate', op: '>=', value: `${period}-01` },
        { field: 'businessDate', op: '<=', value: `${period}-31` },
      ],
    }),
    repos.attendance.find({
      where: [
        brand,
        { field: 'date', op: '>=', value: `${period}-01` },
        { field: 'date', op: '<=', value: `${period}-31` },
      ],
    }),
    repos.payrollAdjustments.find({ where: [brand, eq('period', period)] }),
  ]);
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  // Shop daily totals per location (SWOMS counted the whole shop's cars for everyone).
  const counts = new Map<string, Record<string, number>>();
  for (const o of orders) {
    const byDay = counts.get(o.locationId) ?? {};
    byDay[o.businessDate] = (byDay[o.businessDate] ?? 0) + 1;
    counts.set(o.locationId, byDay);
  }
  const settingsCache = new Map<string, Awaited<ReturnType<typeof getSettings>>>();
  const lines: PayslipLine[] = [];
  for (const e of employees) {
    const loc = e.locationIds[0];
    if (!loc) continue;
    if (!settingsCache.has(loc)) settingsCache.set(loc, await getSettings(repos, brandId, loc));
    const rule = e.incentiveRuleId ? ruleById.get(e.incentiveRuleId) : undefined;
    lines.push(
      computePayslip({
        employee: e,
        period,
        rule: rule ?? null,
        dailyCounts: counts.get(loc) ?? {},
        attendance: Object.fromEntries(
          attendance
            .filter((a) => a.employeeId === e.id)
            .map((a) => [a.date, a.status as AttendanceStatus]),
        ),
        adjustments: adjustments.filter((a) => a.employeeId === e.id),
        settings: settingsCache.get(loc)!,
      }),
    );
  }
  return { period, lines, totals: payrollTotals(lines) };
}

/** Freezes the period's payroll as an immutable run. Corrections go in a supplementary run. */
export async function finalizePayroll(
  tx: Repositories,
  ctx: Ctx,
  period: string,
  kind: 'REGULAR' | 'SUPPLEMENTARY',
): Promise<PayrollRun> {
  const brand = eq<{ brandId: string }>('brandId', ctx.actor.brandId);
  const prior = await tx.payrollRuns.find({
    where: [brand, eq('period', period)],
    orderBy: { field: 'createdAt' },
  });
  const regular = prior.find((r) => r.kind === 'REGULAR');
  if (kind === 'REGULAR' && regular)
    throw new AppError('PERIOD_ALREADY_FINALIZED', `Payroll for ${period} is already finalized`);
  if (kind === 'SUPPLEMENTARY' && !regular)
    throw new AppError('CONFLICT', 'Finalize the regular run first');
  const preview = await previewPayroll(tx, ctx, period);
  const run: PayrollRun = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    createdAt: ctx.now.toISOString(),
    createdBy: ctx.actor.id,
    period,
    kind,
    supersedesId: kind === 'SUPPLEMENTARY' ? (prior.at(-1)?.id ?? null) : null,
    lines: preview.lines,
    totals: preview.totals,
  };
  await tx.payrollRuns.insert(run);
  await audit(tx, ctx, {
    action: 'payroll.finalize',
    entity: 'payrollRun',
    entityId: run.id,
    after: { period, kind, totals: run.totals, employees: run.lines.length },
  });
  return run;
}

export async function listRuns(
  repos: Pick<Repositories, 'payrollRuns'>,
  brandId: string,
  period?: string,
) {
  const where = [eq<PayrollRun>('brandId', brandId)];
  if (period) where.push(eq('period', period));
  return repos.payrollRuns.find({ where, orderBy: { field: 'createdAt', dir: 'desc' }, limit: 50 });
}

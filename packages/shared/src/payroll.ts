import { daysInPeriod, isWeekend, type DateKey, type PeriodKey } from './dates';
import { percentOf, sum, type Cents } from './money';
import type { Settings } from './schemas/catalog';
import type { AttendanceStatus, IncentiveTier, PayrollAdjustment, PayslipLine } from './schemas/hr';

/** Highest tier whose target the day's count reaches (SWOMS: not cumulative). */
export function dailyIncentive(
  count: number,
  tiers: readonly IncentiveTier[],
): { tierTarget: number; bonusCents: Cents } | null {
  let best: IncentiveTier | null = null;
  for (const t of tiers) if (count >= t.target && (!best || t.target > best.target)) best = t;
  return best ? { tierTarget: best.target, bonusCents: best.bonusCents } : null;
}

export interface PayslipInput {
  employee: {
    id: string;
    name: string;
    code: string;
    jobTitle: string;
    baseSalaryCents: Cents;
    recurringAdditionCents: Cents;
    recurringDeductionCents: Cents;
    exemptMonths: readonly string[];
  };
  period: PeriodKey;
  rule: { weekdayTiers: IncentiveTier[]; weekendTiers: IncentiveTier[] } | null;
  /** Completed vehicles per business day for the employee's location (shop total, as SWOMS). */
  dailyCounts: Readonly<Record<DateKey, number>>;
  attendance: Readonly<Record<DateKey, AttendanceStatus>>;
  adjustments: readonly Pick<
    PayrollAdjustment,
    'date' | 'kind' | 'category' | 'reason' | 'amountCents'
  >[];
  settings: Pick<Settings, 'weekendDays' | 'payroll'>;
}

/**
 * One employee's pay for a period:
 * net = base + incentive + bonus adjustments + recurring addition
 *       − (recurring deduction + one-off deductions + employee EPF).
 * Recurring items are skipped when the period is in `exemptMonths`.
 */
export function computePayslip(input: PayslipInput): PayslipLine {
  const { employee: e, settings } = input;
  const mult = settings.payroll.attendanceMultiplier;
  const incentiveBreakdown: PayslipLine['incentiveBreakdown'] = [];
  if (input.rule) {
    for (const date of daysInPeriod(input.period)) {
      const tiers = isWeekend(date, settings.weekendDays)
        ? input.rule.weekendTiers
        : input.rule.weekdayTiers;
      const hit = dailyIncentive(input.dailyCounts[date] ?? 0, tiers);
      if (!hit) continue;
      // Missing attendance counts as present, so turning the feature on never zeroes past pay by accident.
      const multiplier = mult.enabled ? mult[input.attendance[date] ?? 'PRESENT'] : 1;
      const bonusCents = Math.round(hit.bonusCents * multiplier);
      if (bonusCents > 0) {
        incentiveBreakdown.push({
          date,
          count: input.dailyCounts[date] ?? 0,
          tierTarget: hit.tierTarget,
          bonusCents,
          multiplier,
        });
      }
    }
  }
  const exempt = e.exemptMonths.includes(input.period);
  const recurringAdditionCents = exempt ? 0 : e.recurringAdditionCents;
  const recurringDeductionCents = exempt ? 0 : e.recurringDeductionCents;
  const deductions = input.adjustments.filter((a) => a.kind === 'DEDUCTION');
  const bonuses = input.adjustments.filter((a) => a.kind === 'BONUS');
  const oneOffDeductionCents = sum(deductions.map((d) => d.amountCents));
  const bonusAdjCents = sum(bonuses.map((b) => b.amountCents));
  const st = settings.payroll.statutory;
  const epfEmployeeCents = st.enabled ? percentOf(e.baseSalaryCents, st.epfEmployeePct) : 0;
  const epfEmployerCents = st.enabled ? percentOf(e.baseSalaryCents, st.epfEmployerPct) : 0;
  const etfEmployerCents = st.enabled ? percentOf(e.baseSalaryCents, st.etfEmployerPct) : 0;
  const incentiveCents = sum(incentiveBreakdown.map((d) => d.bonusCents));
  const netCents =
    sum([e.baseSalaryCents, incentiveCents, bonusAdjCents, recurringAdditionCents]) -
    sum([recurringDeductionCents, oneOffDeductionCents, epfEmployeeCents]);
  return {
    employeeId: e.id,
    name: e.name,
    code: e.code,
    jobTitle: e.jobTitle,
    baseCents: e.baseSalaryCents,
    incentiveCents,
    incentiveBreakdown,
    bonusAdjCents,
    recurringAdditionCents,
    recurringDeductionCents,
    oneOffDeductionCents,
    deductionBreakdown: [
      ...deductions.map((d) => ({
        date: d.date,
        reason: `${d.category}: ${d.reason}`,
        amountCents: d.amountCents,
      })),
      ...(recurringDeductionCents
        ? [{ date: 'Monthly', reason: 'Recurring deduction', amountCents: recurringDeductionCents }]
        : []),
      ...(epfEmployeeCents
        ? [
            {
              date: 'Monthly',
              reason: `EPF employee ${st.epfEmployeePct}%`,
              amountCents: epfEmployeeCents,
            },
          ]
        : []),
    ],
    epfEmployeeCents,
    epfEmployerCents,
    etfEmployerCents,
    netCents,
  };
}

export function payrollTotals(lines: readonly PayslipLine[]) {
  const gross = sum(
    lines.map((l) => l.baseCents + l.incentiveCents + l.bonusAdjCents + l.recurringAdditionCents),
  );
  const deductions = sum(
    lines.map((l) => l.recurringDeductionCents + l.oneOffDeductionCents + l.epfEmployeeCents),
  );
  return {
    grossCents: gross,
    deductionsCents: deductions,
    netCents: sum(lines.map((l) => l.netCents)),
    employerCostCents: gross + sum(lines.map((l) => l.epfEmployerCents + l.etfEmployerCents)),
  };
}

import { describe, expect, it } from 'vitest';
import {
  computePayslip,
  dailyIncentive,
  DEFAULT_SETTINGS,
  payrollTotals,
  type PayslipInput,
} from '../src';

const tiers = [
  { target: 10, bonusCents: 25_000 },
  { target: 15, bonusCents: 50_000 },
  { target: 20, bonusCents: 75_000 },
];

const base: PayslipInput = {
  employee: {
    id: 'e1',
    name: 'Kasun',
    code: 'SW001',
    jobTitle: 'Washer',
    baseSalaryCents: 4_500_000,
    recurringAdditionCents: 250_000,
    recurringDeductionCents: 100_000,
    exemptMonths: [],
  },
  period: '2026-11',
  rule: { weekdayTiers: tiers, weekendTiers: [{ target: 15, bonusCents: 60_000 }] },
  // 2026-11-02 Monday, 2026-11-07 Saturday, 2026-11-08 Sunday
  dailyCounts: {
    '2026-11-02': 12,
    '2026-11-03': 21,
    '2026-11-04': 9,
    '2026-11-07': 16,
    '2026-11-08': 14,
  },
  attendance: {},
  adjustments: [],
  settings: { weekendDays: DEFAULT_SETTINGS.weekendDays, payroll: DEFAULT_SETTINGS.payroll },
};

describe('dailyIncentive', () => {
  it('pays the highest tier reached, not the sum', () => {
    expect(dailyIncentive(9, tiers)).toBeNull();
    expect(dailyIncentive(10, tiers)).toEqual({ tierTarget: 10, bonusCents: 25_000 });
    expect(dailyIncentive(19, tiers)?.bonusCents).toBe(50_000);
    expect(dailyIncentive(40, tiers)?.bonusCents).toBe(75_000);
    expect(dailyIncentive(40, [...tiers].reverse())?.bonusCents).toBe(75_000); // order-independent
  });
});

describe('computePayslip', () => {
  it('matches the SWOMS formula', () => {
    const p = computePayslip(base);
    // weekday: 12→250, 21→750, 9→0; weekend: 16→600, 14→0  = 1,600
    expect(p.incentiveCents).toBe(160_000);
    expect(p.incentiveBreakdown.map((d) => d.date)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-07',
    ]);
    // 45,000 + 1,600 + 2,500 − 1,000
    expect(p.netCents).toBe(4_810_000);
  });

  it('skips recurring items in an exempt month', () => {
    const p = computePayslip({
      ...base,
      employee: { ...base.employee, exemptMonths: ['2026-11'] },
    });
    expect(p.recurringAdditionCents).toBe(0);
    expect(p.recurringDeductionCents).toBe(0);
    expect(p.netCents).toBe(4_660_000);
  });

  it('nets one-off deductions and ± bonus adjustments, including reversals', () => {
    const p = computePayslip({
      ...base,
      adjustments: [
        {
          date: '2026-11-05',
          kind: 'DEDUCTION',
          category: 'ADVANCE',
          reason: 'Advance',
          amountCents: 500_000,
        },
        {
          date: '2026-11-06',
          kind: 'DEDUCTION',
          category: 'ADVANCE',
          reason: 'reversed',
          amountCents: -500_000,
        },
        {
          date: '2026-11-06',
          kind: 'DEDUCTION',
          category: 'FOOD',
          reason: 'Meals',
          amountCents: 30_000,
        },
        {
          date: '2026-11-09',
          kind: 'BONUS',
          category: 'Extra',
          reason: 'Sunday cover',
          amountCents: 100_000,
        },
        {
          date: '2026-11-10',
          kind: 'BONUS',
          category: 'Late',
          reason: 'Late',
          amountCents: -20_000,
        },
      ],
    });
    expect(p.oneOffDeductionCents).toBe(30_000);
    expect(p.bonusAdjCents).toBe(80_000);
    expect(p.netCents).toBe(4_810_000 - 30_000 + 80_000);
  });

  it('pays no incentive without a rule', () => {
    expect(computePayslip({ ...base, rule: null }).incentiveCents).toBe(0);
  });

  it('weights incentives by attendance when enabled', () => {
    const payroll = {
      ...DEFAULT_SETTINGS.payroll,
      attendanceMultiplier: { ...DEFAULT_SETTINGS.payroll.attendanceMultiplier, enabled: true },
    };
    const p = computePayslip({
      ...base,
      attendance: { '2026-11-02': 'HALF_DAY', '2026-11-03': 'ABSENT' },
      settings: { ...base.settings, payroll },
    });
    // 250×0.5 + 750×0 + 600×1 (no record = present)
    expect(p.incentiveCents).toBe(72_500);
  });

  it('applies EPF/ETF when enabled', () => {
    const payroll = {
      ...DEFAULT_SETTINGS.payroll,
      statutory: { ...DEFAULT_SETTINGS.payroll.statutory, enabled: true },
    };
    const p = computePayslip({ ...base, settings: { ...base.settings, payroll } });
    expect(p.epfEmployeeCents).toBe(360_000); // 8% of 45,000
    expect(p.epfEmployerCents).toBe(540_000);
    expect(p.etfEmployerCents).toBe(135_000);
    expect(p.netCents).toBe(4_810_000 - 360_000);
    const totals = payrollTotals([p]);
    expect(totals.employerCostCents - totals.grossCents).toBe(675_000);
  });
});

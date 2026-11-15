import { DEFAULT_SETTINGS, type PayslipLine } from '@stopwash/shared';
import { periodLabel, salarySlipPdf } from './salarySlipPdf';

const line: PayslipLine = {
  employeeId: 'e1',
  name: 'Kasun Perera',
  code: 'SW001',
  jobTitle: 'Washer',
  baseCents: 4500000,
  incentiveCents: 75000,
  incentiveBreakdown: [
    { date: '2026-11-02', count: 12, tierTarget: 10, bonusCents: 25000, multiplier: 1 },
  ],
  bonusAdjCents: 0,
  recurringAdditionCents: 250000,
  recurringDeductionCents: 100000,
  oneOffDeductionCents: 30000,
  deductionBreakdown: [{ date: '2026-11-06', reason: 'FOOD: Meals', amountCents: 30000 }],
  epfEmployeeCents: 0,
  epfEmployerCents: 0,
  etfEmployerCents: 0,
  netCents: 4695000,
};

describe('salary slip', () => {
  it('labels the period', () => {
    expect(periodLabel('2026-11')).toBe('November 2026');
  });

  it('renders a PDF', async () => {
    const blob = await salarySlipPdf(line, '2026-11', DEFAULT_SETTINGS.business, 'FINAL');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(2000);
  });
});

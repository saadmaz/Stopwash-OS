import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { reconciliationPdf, type ShiftReport } from './reconciliationPdf';

const report = {
  shift: {
    id: 's1',
    supervisorName: 'Dilani',
    openedAt: '2026-11-15T02:00:00.000Z',
    closedAt: '2026-11-15T12:00:00.000Z',
    businessDate: '2026-11-15',
    openingCount: { notes: { '100000': 10 }, coinsCents: 0 },
  },
  reconciliation: {
    openingCents: 1_000_000,
    cashSalesCents: 75_000,
    cardSalesCents: 100_000,
    expensesCents: 20_000,
    depositsCents: 0,
    expectedCents: 1_055_000,
  },
  vehicleCount: 2,
  closes: [
    {
      kind: 'CLOSE',
      expectedCents: 1_055_000,
      countedCents: 1_000_000,
      varianceCents: -55_000,
      vehicleCount: 2,
      notes: 'Gave change twice',
      handoverName: 'Kasun',
      overrideByEmployeeId: null,
      closingCount: { notes: { '100000': 10 }, coinsCents: 0 },
    },
  ],
  cashMovements: [
    {
      type: 'EXPENSE',
      categoryCode: 'E004',
      categoryName: 'Staff meals',
      paidTo: 'Canteen',
      description: null,
      reason: null,
      amountCents: 20_000,
    },
  ],
  business: DEFAULT_SETTINGS.business,
  denominations: DEFAULT_SETTINGS.denominations,
} as unknown as ShiftReport;

describe('reconciliationPdf', () => {
  it('renders an A4 PDF for a closed shift', async () => {
    const blob = await reconciliationPdf(report, new Date('2026-11-15T12:05:00Z'));
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(2000);
  });

  it('renders for an open shift without a close record', async () => {
    const blob = await reconciliationPdf({ ...report, closes: [] });
    expect(blob.type).toBe('application/pdf');
  });
});

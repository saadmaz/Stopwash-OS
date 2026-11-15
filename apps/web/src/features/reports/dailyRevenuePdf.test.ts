import { DEFAULT_SETTINGS } from '@stopwash/shared';
import { dailyRevenuePdf } from './dailyRevenuePdf';

describe('dailyRevenuePdf', () => {
  it('renders many rows across pages', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      number: `1511${String(i).padStart(3, '0')}`,
      completedAt: '2026-11-15T04:00:00.000Z',
      plate: `WP CAB-${i}`,
      customer: i % 2 ? 'Nimal' : null,
      services: 'Medium (SUV) + Wax + Air freshener ×2',
      method: i % 3 ? 'CASH' : 'CARD',
      totalCents: 225000,
    }));
    const blob = await dailyRevenuePdf({
      date: '2026-11-15',
      business: DEFAULT_SETTINGS.business,
      rows,
      totals: {
        vehicles: 40,
        cashCents: 1,
        cardCents: 2,
        otherCents: 0,
        refundsCents: 0,
        grandTotalCents: 3,
        discountsCents: 0,
      },
      target: 15,
    });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(4000);
  });
});

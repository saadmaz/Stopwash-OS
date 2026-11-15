import { DEFAULT_SETTINGS, type Invoice } from '@stopwash/shared';
import { invoicePdf } from './invoicePdf';

describe('invoicePdf', () => {
  it('renders a vector invoice with bank details', async () => {
    const inv = {
      number: '55100',
      date: '2026-11-15',
      customerSnapshot: { name: 'Lanka Fleet (Pvt) Ltd', address: 'Colombo 03' },
      lines: [{ description: 'Van wash', qty: 10, unitPriceCents: 125000, totalCents: 1250000 }],
      subtotalCents: 1250000,
      discountCents: 50000,
      totalCents: 1200000,
    } as unknown as Invoice;
    const blob = await invoicePdf(inv, { ...DEFAULT_SETTINGS.business, bankDetails: 'BOC 123' }, 0);
    expect(blob.type).toBe('application/pdf');
  });
});

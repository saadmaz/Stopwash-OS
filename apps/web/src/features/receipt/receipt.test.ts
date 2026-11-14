import { DEFAULT_SETTINGS, type Order, type Payment } from '@stopwash/shared';
import {
  buildReceipt,
  formatColombo,
  receiptText,
  receiptWhatsappLink,
  type ReceiptData,
} from './receipt';
import { receiptPdf } from './receiptPdf';

const order = {
  number: '1511007',
  ticket: 7,
  plateKey: 'WPCAB1234',
  plateDisplay: 'WP CAB-1234',
  customerName: 'Nimal',
  customerPhone: '+94771234567',
  createdAt: '2026-11-15T03:00:00.000Z',
  completedAt: '2026-11-15T03:45:00.000Z',
  lines: [
    {
      itemId: 'm',
      kind: 'vehicleClass',
      code: 'MEDIUM',
      name: 'Medium (SUV)',
      unitPriceCents: 100000,
      qty: 1,
      totalCents: 100000,
    },
    {
      itemId: 'f',
      kind: 'product',
      code: 'AF',
      name: 'Air freshener',
      unitPriceCents: 50000,
      qty: 2,
      totalCents: 100000,
    },
  ],
  subtotalCents: 200000,
  loyaltyDiscountCents: 0,
  discountCents: 20000,
  discountReason: 'Regular',
  taxCents: 0,
  totalCents: 180000,
} as unknown as Order;

const data: ReceiptData = {
  order,
  payments: [
    { method: 'CASH', amountCents: 100000 },
    { method: 'CARD', amountCents: 80000 },
  ] as unknown as Payment[],
  business: DEFAULT_SETTINGS.business,
  footer: 'Thank you for choosing STOPWASH',
};

describe('receipt model', () => {
  it('shows Colombo time', () => {
    expect(formatColombo('2026-11-15T03:45:00.000Z')).toBe('15 Nov 2026, 09:15');
  });

  it('lists lines, discount, total and split payments', () => {
    const m = buildReceipt(data);
    expect(m.meta).toContainEqual(['Receipt', '1511007']);
    expect(m.lines[1]).toEqual({ label: 'Air freshener × 2 @ 500.00', amount: 'LKR 1,000.00' });
    expect(m.totals.map((t) => t.label)).toEqual(['Subtotal', 'Discount (Regular)', 'TOTAL']);
    expect(m.totals.at(-1)).toMatchObject({ amount: 'LKR 1,800.00', emphasis: true });
    expect(m.payments.map((p) => p.label)).toEqual(['Cash', 'Card']);
  });

  it('builds a WhatsApp click-to-chat link to the customer', () => {
    const link = receiptWhatsappLink(data)!;
    expect(link.startsWith('https://wa.me/94771234567?text=')).toBe(true);
    expect(receiptText(buildReceipt(data))).toContain('*TOTAL: LKR 1,800.00*');
    expect(receiptWhatsappLink({ ...data, order: { ...order, customerPhone: null } })).toBeNull();
  });

  it('renders a PDF', async () => {
    const blob = await receiptPdf(buildReceipt(data));
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
  });
});

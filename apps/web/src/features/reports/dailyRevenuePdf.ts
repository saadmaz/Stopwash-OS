import { formatLKR, type Settings } from '@stopwash/shared';
import { brand } from '@stopwash/ui';

export interface DailyReport {
  date: string;
  business: Settings['business'];
  rows: Array<{
    number: string | null;
    completedAt: string | null;
    plate: string;
    customer: string | null;
    services: string;
    method: string;
    totalCents: number;
  }>;
  totals: {
    vehicles: number;
    cashCents: number;
    cardCents: number;
    otherCents: number;
    refundsCents: number;
    grandTotalCents: number;
    discountsCents: number;
  };
  target: number;
}

const time = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : '';

/** SWOMS "Daily Service Revenue Report": time, plate & customer, services, payment, amount, totals. */
export async function dailyRevenuePdf(r: DailyReport): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 15;
  const R = 195;
  doc.setFillColor(brand.navy).rect(0, 0, 210, 26, 'F');
  doc
    .setTextColor('#FFFFFF')
    .setFont('helvetica', 'bold')
    .setFontSize(14)
    .text(r.business.name, L, 12);
  doc.setFontSize(10).setFont('helvetica', 'normal').text('Daily Service Revenue Report', L, 19);
  doc.text(`Date: ${r.date}`, R, 19, { align: 'right' });
  let y = 36;
  const head = () => {
    doc.setFillColor('#ECEEE8').rect(L, y - 5, R - L, 8, 'F');
    doc.setTextColor(brand.ink).setFont('helvetica', 'bold').setFontSize(8);
    doc
      .text('TIME', L + 1, y)
      .text('PLATE & CUSTOMER', 35, y)
      .text('SERVICE & ADD-ONS', 95, y)
      .text('PAYMENT', 155, y);
    doc.text('AMOUNT (LKR)', R - 1, y, { align: 'right' });
    y += 8;
  };
  head();
  doc.setFont('helvetica', 'normal');
  for (const row of r.rows) {
    const services = doc.splitTextToSize(row.services, 56) as string[];
    const h = Math.max(9, services.length * 4 + 2);
    if (y + h > 250) {
      doc.addPage();
      y = 20;
      head();
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(8).setTextColor(brand.ink);
    doc.text(time(row.completedAt), L + 1, y);
    doc.setFont('helvetica', 'bold').text(row.plate, 35, y);
    doc
      .setFont('helvetica', 'normal')
      .setTextColor('#4E5766')
      .text(row.customer ?? '', 35, y + 4);
    doc.setTextColor(brand.ink).text(services, 95, y);
    doc.text(row.method, 155, y);
    doc.text(formatLKR(row.totalCents, { currency: false }), R - 1, y, { align: 'right' });
    y += h;
    doc.setDrawColor('#E2E4E0').line(L, y - 4, R, y - 4);
  }
  y += 4;
  const total = (label: string, value: string, bold = false) => {
    doc
      .setFont('helvetica', bold ? 'bold' : 'normal')
      .setFontSize(bold ? 11 : 9)
      .setTextColor(brand.ink);
    doc.text(label, 120, y);
    doc.text(value, R, y, { align: 'right' });
    y += bold ? 8 : 6;
  };
  total('Completed orders:', `${r.totals.vehicles} / ${r.target}`);
  total('Card revenue:', formatLKR(r.totals.cardCents));
  total('Cash revenue:', formatLKR(r.totals.cashCents));
  if (r.totals.otherCents) total('Other:', formatLKR(r.totals.otherCents));
  if (r.totals.refundsCents)
    total('Refunds (included above):', `-${formatLKR(r.totals.refundsCents)}`);
  if (r.totals.discountsCents) total('Discounts given:', formatLKR(r.totals.discountsCents));
  total('GRAND TOTAL REVENUE:', formatLKR(r.totals.grandTotalCents), true);
  doc
    .setFontSize(8)
    .setTextColor('#4E5766')
    .text(`${r.business.name} · Internal document`, 105, 290, { align: 'center' });
  return doc.output('blob');
}

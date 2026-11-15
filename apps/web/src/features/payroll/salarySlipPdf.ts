import { formatLKR, type PayslipLine, type Settings } from '@stopwash/shared';
import { brand } from '@stopwash/ui';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** A4 salary slip, branded like the SWOMS slip (navy header), with itemised bonus and deductions. */
export async function salarySlipPdf(
  line: PayslipLine,
  period: string,
  business: Settings['business'],
  status: 'DRAFT' | 'FINAL',
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 15;
  const R = 195;
  doc.setFillColor(brand.navy).rect(0, 0, 210, 30, 'F');
  doc.setFillColor(brand.lime).roundedRect(L, 9, 12, 12, 2, 2, 'F');
  doc
    .setTextColor(brand.ink)
    .setFont('helvetica', 'bold')
    .setFontSize(10)
    .text('SW', L + 6, 16.8, { align: 'center' });
  doc
    .setTextColor('#FFFFFF')
    .setFontSize(15)
    .text('Salary Slip', L + 17, 15);
  doc
    .setFontSize(9)
    .setFont('helvetica', 'normal')
    .text(business.name, L + 17, 21);
  doc.text(periodLabel(period), R, 15, { align: 'right' });
  if (status === 'DRAFT') doc.setTextColor(brand.lime).text('DRAFT', R, 21, { align: 'right' });

  doc.setTextColor(brand.ink).setFontSize(10);
  let y = 42;
  const kv = (k: string, v: string, x: number) => {
    doc.setFont('helvetica', 'bold').text(k, x, y);
    doc.setFont('helvetica', 'normal').text(v, x + 30, y);
  };
  kv('Employee', line.name, L);
  kv('Code', line.code, 110);
  y += 6;
  kv('Role', line.jobTitle, L);
  kv('Period', periodLabel(period), 110);
  y += 12;

  const row = (label: string, cents: number, bold = false, sign = '') => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 11 : 10);
    doc.text(label, L, y);
    doc.text(`${sign}${formatLKR(cents)}`, R, y, { align: 'right' });
    y += 7;
  };
  const section = (title: string) => {
    doc.setFillColor('#ECEEE8').rect(L, y - 5, R - L, 7, 'F');
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(9)
      .text(title.toUpperCase(), L + 2, y);
    y += 8;
  };
  section('Earnings');
  row('Base salary', line.baseCents);
  row('Performance bonus', line.incentiveCents);
  if (line.recurringAdditionCents) row('Fixed addition', line.recurringAdditionCents);
  if (line.bonusAdjCents) row('Bonus adjustments', line.bonusAdjCents);
  y += 2;
  section('Deductions');
  for (const d of line.deductionBreakdown)
    row(`${d.date} · ${d.reason}`.slice(0, 70), d.amountCents, false, '-');
  if (!line.deductionBreakdown.length) row('None', 0);
  y += 2;
  doc.setFillColor(brand.navy).rect(L, y - 5, R - L, 10, 'F');
  doc
    .setTextColor('#FFFFFF')
    .setFont('helvetica', 'bold')
    .setFontSize(12)
    .text('NET PAY', L + 3, y + 1.5);
  doc.text(formatLKR(line.netCents), R - 3, y + 1.5, { align: 'right' });
  doc.setTextColor(brand.ink);
  y += 16;
  if (line.epfEmployerCents || line.etfEmployerCents) {
    doc
      .setFont('helvetica', 'normal')
      .setFontSize(8)
      .text(
        `Employer contributions (not deducted): EPF ${formatLKR(line.epfEmployerCents)} · ETF ${formatLKR(line.etfEmployerCents)}`,
        L,
        y,
      );
    y += 8;
  }
  if (line.incentiveBreakdown.length) {
    section('Bonus breakdown');
    doc.setFont('helvetica', 'normal').setFontSize(8);
    for (const d of line.incentiveBreakdown) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(
        `${d.date}  ·  ${d.count} vehicles  ·  ${d.tierTarget}+ tier${d.multiplier < 1 ? ` × ${d.multiplier}` : ''}`,
        L,
        y,
      );
      doc.text(formatLKR(d.bonusCents), R, y, { align: 'right' });
      y += 5;
    }
  }
  doc
    .setFontSize(8)
    .setTextColor('#4E5766')
    .text(`${business.name} · Confidential`, 105, 290, { align: 'center' });
  return doc.output('blob');
}

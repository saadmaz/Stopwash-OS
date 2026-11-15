import { formatLKR, type Invoice, type Settings } from '@stopwash/shared';
import { brand } from '@stopwash/ui';

/** A4 invoice with vector text (SWOMS used a blurry html2canvas screenshot). */
export async function invoicePdf(
  inv: Invoice,
  business: Settings['business'],
  paidCents: number,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 15;
  const R = 195;
  doc.setFillColor(brand.navy).rect(0, 0, 210, 34, 'F');
  doc
    .setTextColor('#FFFFFF')
    .setFont('helvetica', 'bold')
    .setFontSize(16)
    .text(business.name, L, 14);
  doc.setFont('helvetica', 'normal').setFontSize(8);
  [
    business.address,
    business.phone,
    business.email,
    business.taxId ? `Tax ID ${business.taxId}` : null,
  ]
    .filter((x): x is string => !!x)
    .forEach((line, i) => doc.text(line, L, 20 + i * 4));
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(20)
    .setTextColor(brand.lime)
    .text('INVOICE', R, 16, { align: 'right' });
  doc
    .setFontSize(9)
    .setTextColor('#FFFFFF')
    .text(`No. ${inv.number}`, R, 23, { align: 'right' })
    .text(inv.date, R, 28, { align: 'right' });

  let y = 46;
  doc.setTextColor(brand.ink).setFont('helvetica', 'bold').setFontSize(9).text('BILL TO', L, y);
  doc
    .setFont('helvetica', 'normal')
    .setFontSize(10)
    .text(inv.customerSnapshot.name, L, y + 6);
  if (inv.customerSnapshot.address)
    doc
      .setFontSize(9)
      .text(doc.splitTextToSize(inv.customerSnapshot.address, 90) as string[], L, y + 11);
  y += 26;
  doc.setFillColor('#ECEEE8').rect(L, y - 5, R - L, 8, 'F');
  doc
    .setFont('helvetica', 'bold')
    .setFontSize(8)
    .text('DESCRIPTION', L + 2, y)
    .text('QTY', 130, y, { align: 'right' })
    .text('UNIT (LKR)', 160, y, { align: 'right' })
    .text('AMOUNT (LKR)', R - 2, y, { align: 'right' });
  y += 8;
  doc.setFont('helvetica', 'normal').setFontSize(9);
  for (const l of inv.lines) {
    doc.text(l.description, L + 2, y).text(String(l.qty), 130, y, { align: 'right' });
    doc.text(formatLKR(l.unitPriceCents, { currency: false }), 160, y, { align: 'right' });
    doc.text(formatLKR(l.totalCents, { currency: false }), R - 2, y, { align: 'right' });
    doc.setDrawColor('#E2E4E0').line(L, y + 3, R, y + 3);
    y += 8;
  }
  y += 4;
  const row = (k: string, v: string, bold = false) => {
    doc
      .setFont('helvetica', bold ? 'bold' : 'normal')
      .setFontSize(bold ? 11 : 9)
      .text(k, 140, y)
      .text(v, R - 2, y, { align: 'right' });
    y += bold ? 9 : 6;
  };
  row('Subtotal', formatLKR(inv.subtotalCents));
  if (inv.discountCents) row('Discount', `-${formatLKR(inv.discountCents)}`);
  row('TOTAL', formatLKR(inv.totalCents), true);
  row('Paid', formatLKR(paidCents));
  row('Balance due', formatLKR(Math.max(0, inv.totalCents - paidCents)), true);
  if (business.bankDetails) {
    y += 6;
    doc.setFont('helvetica', 'bold').setFontSize(9).text('Bank details', L, y);
    doc
      .setFont('helvetica', 'normal')
      .text(doc.splitTextToSize(business.bankDetails, 120) as string[], L, y + 5);
  }
  doc
    .setFontSize(8)
    .setTextColor('#4E5766')
    .text(`Thank you for your business · ${business.name}`, 105, 290, { align: 'center' });
  return doc.output('blob');
}

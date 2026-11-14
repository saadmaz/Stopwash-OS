import { brand } from '@stopwash/ui';
import type { ReceiptModel, ReceiptRow } from './receipt';

/** 80 mm thermal-receipt-width PDF with vector text (sharp when printed, small file). */
export async function receiptPdf(m: ReceiptModel): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const width = 80;
  const lineH = 4.6;
  const rows =
    m.meta.length + m.lines.length + m.totals.length + m.payments.length + m.header.length;
  const height = 70 + rows * lineH;
  const doc = new jsPDF({ unit: 'mm', format: [width, height] });
  const left = 5;
  const right = width - 5;
  let y = 0;

  // Brand header block (navy with lime mark, as on stopwash.lk)
  doc.setFillColor(brand.navy);
  doc.rect(0, 0, width, 18, 'F');
  doc.setFillColor(brand.lime);
  doc.roundedRect(left, 5, 8, 8, 1.5, 1.5, 'F');
  doc
    .setTextColor(brand.ink)
    .setFont('helvetica', 'bold')
    .setFontSize(7)
    .text('SW', left + 4, 10.2, { align: 'center' });
  doc
    .setTextColor('#FFFFFF')
    .setFontSize(11)
    .text(m.title, left + 11, 10.5);
  y = 24;

  doc.setTextColor(brand.ink).setFont('helvetica', 'normal').setFontSize(7.5);
  for (const h of m.header) {
    doc.text(h, width / 2, y, { align: 'center' });
    y += lineH - 0.8;
  }
  y += 2;
  const rule = () => {
    doc.setDrawColor('#C5CAD2').setLineWidth(0.2).line(left, y, right, y);
    y += 4;
  };
  rule();
  doc.setFontSize(8);
  for (const [k, v] of m.meta) {
    doc.setFont('helvetica', 'normal').text(k, left, y);
    doc.setFont('helvetica', 'bold').text(v, right, y, { align: 'right' });
    y += lineH;
  }
  rule();
  const block = (rows: ReceiptRow[]) => {
    for (const r of rows) {
      doc.setFont('helvetica', r.emphasis ? 'bold' : 'normal').setFontSize(r.emphasis ? 10 : 8);
      const label = doc.splitTextToSize(r.label, right - left - 24) as string[];
      doc.text(label, left, y);
      doc.text(r.amount, right, y, { align: 'right' });
      y += lineH * label.length + (r.emphasis ? 1 : 0);
    }
  };
  block(m.lines);
  rule();
  block(m.totals);
  y += 1;
  doc.setFont('helvetica', 'bold').setFontSize(8).text('Paid by', left, y);
  y += lineH;
  block(m.payments);
  y += 3;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor('#4E5766');
  for (const f of m.footer) {
    doc.text(f, width / 2, y, { align: 'center' });
    y += lineH - 0.8;
  }
  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

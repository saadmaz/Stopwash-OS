import {
  formatLKR,
  type CashMovement,
  type Reconciliation,
  type Settings,
  type Shift,
  type ShiftClose,
} from '@stopwash/shared';
import { brand } from '@stopwash/ui';
import { drawBrandMark } from '@/lib/pdfBrand';
import { formatColombo } from '@/features/receipt/receipt';

export interface ShiftReport {
  shift: Shift;
  reconciliation: Reconciliation;
  vehicleCount: number;
  closes: ShiftClose[];
  cashMovements: CashMovement[];
  business: Settings['business'];
  denominations: number[];
}

const amt = (c: number) => formatLKR(c, { currency: false });

/** A4 daily reconciliation report with the same sections as the SWOMS PDF. */
export async function reconciliationPdf(r: ShiftReport, generatedAt = new Date()): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const close = r.closes.find((c) => c.kind === 'CLOSE') ?? null;
  const L = 15;
  const R = 195;
  let y = 0;

  doc.setFillColor(brand.navy).rect(0, 0, 210, 28, 'F');
  drawBrandMark(doc, L, 7, 14);
  doc
    .setTextColor('#FFFFFF')
    .setFont('helvetica', 'bold')
    .setFontSize(16)
    .text('Daily Reconciliation Report', 105, 13, { align: 'center' });
  doc
    .setFontSize(9)
    .setFont('helvetica', 'normal')
    .text(r.business.name, 105, 21, { align: 'center' });
  doc.setTextColor(brand.ink).setFontSize(9);
  y = 38;
  const kv = (k: string, v: string, x = L) => {
    doc.setFont('helvetica', 'bold').text(k, x, y);
    doc.setFont('helvetica', 'normal').text(v, x + 32, y);
  };
  kv('Generated:', formatColombo(generatedAt.toISOString()));
  kv('Supervisor:', r.shift.supervisorName, 110);
  y += 6;
  kv('Shift ID:', r.shift.id);
  kv('Vehicles:', String(close?.vehicleCount ?? r.vehicleCount), 110);
  y += 6;
  kv(
    'Period:',
    `${formatColombo(r.shift.openedAt)} – ${r.shift.closedAt ? formatColombo(r.shift.closedAt) : 'open'}`,
  );
  y += 10;

  const table = (title: string, head: string[], rows: string[][], widths: number[]) => {
    doc.setFont('helvetica', 'bold').setFontSize(10).text(title, L, y);
    y += 3;
    doc.setFillColor('#ECEEE8').rect(L, y, R - L, 7, 'F');
    doc.setFontSize(8);
    let x = L + 2;
    head.forEach((h, i) => {
      const right = i === head.length - 1;
      doc.text(h, right ? R - 2 : x, y + 5, right ? { align: 'right' } : undefined);
      x += widths[i]!;
    });
    y += 7;
    doc.setFont('helvetica', 'normal');
    for (const row of rows.length ? rows : [['—', ...head.slice(1).map(() => '')]]) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      x = L + 2;
      row.forEach((cell, i) => {
        const right = i === row.length - 1;
        doc.text(
          String(cell).slice(0, 48),
          right ? R - 2 : x,
          y + 5,
          right ? { align: 'right' } : undefined,
        );
        x += widths[i]!;
      });
      doc.setDrawColor('#E2E4E0').line(L, y + 7, R, y + 7);
      y += 7;
    }
    y += 6;
  };

  const rec = r.reconciliation;
  table(
    'Summary',
    ['Item', 'Amount (LKR)'],
    [
      ['Opening balance', amt(rec.openingCents)],
      ['Cash sales', amt(rec.cashSalesCents)],
      ['Card sales', amt(rec.cardSalesCents)],
      ['Expenses', `-${amt(rec.expensesCents)}`],
      ['Deposits / drops', `-${amt(rec.depositsCents)}`],
      ['Expected cash', amt(close?.expectedCents ?? rec.expectedCents)],
      ['Counted cash', close ? amt(close.countedCents) : '—'],
    ],
    [150, 30],
  );

  const cashRows = (type: 'EXPENSE' | 'DEPOSIT') =>
    r.cashMovements
      .filter((m) => m.type === type)
      .map((m) => [
        m.categoryCode + ' ' + m.categoryName,
        m.paidTo,
        m.reason ?? m.description ?? '',
        amt(m.amountCents),
      ]);
  table(
    'Expense details',
    ['Category', 'Paid to', 'Description', 'Amount'],
    cashRows('EXPENSE'),
    [55, 45, 50, 30],
  );
  table(
    'Deposit / drop details',
    ['Category', 'Collected by', 'Reference', 'Amount'],
    cashRows('DEPOSIT'),
    [55, 45, 50, 30],
  );

  if (close) {
    const v = close.varianceCents;
    const status = v === 0 ? 'MATCHED' : v < 0 ? 'SHORTAGE' : 'OVERAGE';
    doc.setFont('helvetica', 'bold').setFontSize(10).text('Variance analysis', L, y);
    y += 3;
    doc.setFillColor(v === 0 ? '#E3F5E7' : '#FDE7E4').rect(L, y, R - L, 12, 'F');
    doc.setFontSize(11).text(status, L + 4, y + 8);
    doc.text(`LKR ${amt(v)}`, R - 4, y + 8, { align: 'right' });
    y += 18;
    doc.setFontSize(9).setFont('helvetica', 'bold').text('Staff notes / explanation:', L, y);
    doc
      .setFont('helvetica', 'normal')
      .text(doc.splitTextToSize(close.notes ?? '—', R - L) as string[], L, y + 5);
    y += 14;
    doc
      .setFont('helvetica', 'bold')
      .text(
        `Handover signed by: ${close.handoverName ?? '—'}${close.overrideByEmployeeId ? ' · manager override recorded' : ''}`,
        L,
        y,
      );
    y += 8;
    table(
      'Cash denomination breakdown',
      ['Denomination', 'Opening', 'Closing'],
      [
        ...r.denominations.map((d) => [
          formatLKR(d, { compactZeroCents: true }),
          String(r.shift.openingCount.notes[String(d)] ?? 0),
          String(close.closingCount.notes[String(d)] ?? 0),
        ]),
        ['Coins (value)', amt(r.shift.openingCount.coinsCents), amt(close.closingCount.coinsCents)],
      ],
      [80, 50, 50],
    );
  }

  doc
    .setFontSize(8)
    .setTextColor('#4E5766')
    .text(`${r.business.name} · Internal document`, 105, 290, { align: 'center' });
  return doc.output('blob');
}

/** Fetches a shift's report and downloads the PDF (SWOMS auto-downloaded it on close). */
export async function downloadShiftReport(shiftId: string): Promise<void> {
  const [{ api }, { downloadBlob }] = await Promise.all([
    import('@/lib/api'),
    import('@/features/receipt/receiptPdf'),
  ]);
  const report = await api<ShiftReport>(`/shifts/${shiftId}/report`);
  downloadBlob(
    await reconciliationPdf(report),
    `Reconciliation_${report.shift.businessDate}_${shiftId}.pdf`,
  );
}

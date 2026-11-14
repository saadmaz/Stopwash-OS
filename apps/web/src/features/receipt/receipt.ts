import { formatLKR, whatsappLink, type Order, type Payment, type Settings } from '@stopwash/shared';

export interface ReceiptData {
  order: Order;
  payments: Payment[];
  business: Settings['business'];
  footer: string | null;
}

export interface ReceiptRow {
  label: string;
  amount: string;
  emphasis?: boolean;
}

export interface ReceiptModel {
  title: string;
  header: string[];
  meta: Array<[string, string]>;
  lines: ReceiptRow[];
  totals: ReceiptRow[];
  payments: ReceiptRow[];
  footer: string[];
}

const METHOD: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  OTHER: 'Other',
};

export function formatColombo(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** One model for the on-screen receipt, the PDF and the WhatsApp text. Receipts are in English like SWOMS. */
export function buildReceipt(d: ReceiptData): ReceiptModel {
  const o = d.order;
  const totals: ReceiptRow[] = [{ label: 'Subtotal', amount: formatLKR(o.subtotalCents) }];
  if (o.loyaltyDiscountCents)
    totals.push({ label: 'Loyalty reward', amount: `-${formatLKR(o.loyaltyDiscountCents)}` });
  if (o.discountCents)
    totals.push({
      label: o.discountReason ? `Discount (${o.discountReason})` : 'Discount',
      amount: `-${formatLKR(o.discountCents)}`,
    });
  if (o.taxCents) totals.push({ label: 'Tax', amount: formatLKR(o.taxCents) });
  totals.push({ label: 'TOTAL', amount: formatLKR(o.totalCents), emphasis: true });
  return {
    title: d.business.name,
    header: [
      d.business.address,
      d.business.phone,
      d.business.email,
      d.business.taxId ? `Tax ID ${d.business.taxId}` : null,
    ].filter((x): x is string => !!x),
    meta: [
      ['Receipt', o.number ?? '—'],
      ['Date', formatColombo(o.completedAt ?? o.createdAt)],
      ['Vehicle', o.plateDisplay],
      ['Ticket', `#${o.ticket}`],
      ...(o.customerName ? ([['Customer', o.customerName]] as Array<[string, string]>) : []),
    ],
    lines: o.lines.map((l) => ({
      label:
        l.qty > 1
          ? `${l.name} × ${l.qty} @ ${formatLKR(l.unitPriceCents, { currency: false })}`
          : l.name,
      amount: formatLKR(l.totalCents),
    })),
    totals,
    payments: d.payments.map((p) => ({
      label: METHOD[p.method] ?? p.method,
      amount: formatLKR(p.amountCents),
    })),
    footer: [d.footer ?? 'Thank you!', 'stopwash.lk'],
  };
}

/** Plain-text receipt for WhatsApp click-to-chat (no paid API). */
export function receiptText(m: ReceiptModel): string {
  const meta = m.meta.map(([k, v]) => `${k}: ${v}`).join('\n');
  const rows = (r: ReceiptRow[]) =>
    r
      .map((x) => `${x.emphasis ? '*' : ''}${x.label}: ${x.amount}${x.emphasis ? '*' : ''}`)
      .join('\n');
  return [
    `*${m.title}*`,
    meta,
    '',
    rows(m.lines),
    '',
    rows(m.totals),
    rows(m.payments),
    '',
    m.footer.join('\n'),
  ].join('\n');
}

export function receiptWhatsappLink(d: ReceiptData): string | null {
  return d.order.customerPhone
    ? whatsappLink(d.order.customerPhone, receiptText(buildReceipt(d)))
    : null;
}

import { addDays, dateRange, diffDays, type DateKey } from './dates';
import { sum, type Cents } from './money';

export type AnalyticsPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
const LENGTH: Record<Exclude<AnalyticsPeriod, 'CUSTOM'>, number> = {
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 91,
  YEARLY: 365,
};

export interface Window {
  from: DateKey;
  to: DateKey;
  /** Equal-length window just before, for "vs previous period". */
  prevFrom: DateKey;
  prevTo: DateKey;
}

/** Inclusive business-day windows ending today (SWOMS periods; YEARLY now has a real window). */
export function analyticsWindow(
  period: AnalyticsPeriod,
  today: DateKey,
  custom?: { from: DateKey; to: DateKey },
): Window {
  let from: DateKey;
  let to: DateKey;
  if (period === 'CUSTOM') {
    if (!custom || custom.to < custom.from) throw new RangeError('Custom range needs from ≤ to');
    ({ from, to } = custom);
  } else {
    to = today;
    from = addDays(today, -(LENGTH[period] - 1));
  }
  const len = diffDays(from, to) + 1;
  return { from, to, prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
}

export interface SaleLike {
  businessDate: DateKey;
  totalCents: Cents;
  plateKey: string;
  lines: ReadonlyArray<{ code: string }>;
}

export interface SalesSummary {
  count: number;
  revenueCents: Cents;
  avgTicketCents: Cents;
}

const inRange = (d: DateKey, from: DateKey, to: DateKey) => d >= from && d <= to;

export function summarize(orders: readonly SaleLike[]): SalesSummary {
  const revenueCents = sum(orders.map((o) => o.totalCents));
  return {
    count: orders.length,
    revenueCents,
    avgTicketCents: orders.length ? Math.round(revenueCents / orders.length) : 0,
  };
}

/** Sales for a window vs the previous one, optionally only orders containing an item code. */
export function salesStats(orders: readonly SaleLike[], w: Window, itemCode?: string | null) {
  const pick = itemCode ? orders.filter((o) => o.lines.some((l) => l.code === itemCode)) : orders;
  const current = pick.filter((o) => inRange(o.businessDate, w.from, w.to));
  const previous = pick.filter((o) => inRange(o.businessDate, w.prevFrom, w.prevTo));
  const byDay = new Map<DateKey, { count: number; revenueCents: Cents }>();
  for (const o of current) {
    const d = byDay.get(o.businessDate) ?? { count: 0, revenueCents: 0 };
    byDay.set(o.businessDate, { count: d.count + 1, revenueCents: d.revenueCents + o.totalCents });
  }
  const cur = summarize(current);
  const prev = summarize(previous);
  return {
    window: w,
    current: cur,
    previous: prev,
    changePct: prev.revenueCents
      ? ((cur.revenueCents - prev.revenueCents) / prev.revenueCents) * 100
      : null,
    series: dateRange(w.from, w.to).map((date) => ({
      date,
      ...(byDay.get(date) ?? { count: 0, revenueCents: 0 }),
    })),
  };
}

/** New vs returning vehicles in a window (returning = plate seen before the window). */
export function retention(orders: readonly SaleLike[], w: Pick<Window, 'from' | 'to'>) {
  const before = new Set(orders.filter((o) => o.businessDate < w.from).map((o) => o.plateKey));
  const inWindow = new Set(
    orders.filter((o) => inRange(o.businessDate, w.from, w.to)).map((o) => o.plateKey),
  );
  let returning = 0;
  for (const p of inWindow) if (before.has(p)) returning++;
  const total = inWindow.size;
  return {
    returning,
    new: total - returning,
    total,
    retentionPct: total ? Math.round((returning / total) * 100) : 0,
    newPct: total ? Math.round(((total - returning) / total) * 100) : 0,
  };
}

import { businessDate, sum, summarizeLines, type Order, type Payment } from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { eq, type Repositories } from '../repos';
import { getSettings } from './config';
import { locationTimezone } from './orders';

export interface DailyRow {
  orderId: string;
  number: string | null;
  completedAt: string | null;
  plate: string;
  customer: string | null;
  services: string;
  method: string;
  totalCents: number;
  discountCents: number;
}

/** SWOMS "Daily Service Revenue Report" for one business day at one location. */
export async function dailyReport(
  repos: Repositories,
  ctx: Ctx,
  locationId: string,
  date?: string,
) {
  const brandId = ctx.actor.brandId;
  const tz = await locationTimezone(repos, brandId, locationId);
  const day = date ?? businessDate(ctx.now, tz);
  const brand = eq<{ brandId: string }>('brandId', brandId);
  const [orders, payments, settings] = await Promise.all([
    repos.orders.find({
      where: [
        brand,
        eq<Order>('locationId', locationId),
        eq('businessDate', day),
        eq('status', 'COMPLETED'),
      ],
      orderBy: { field: 'completedAt' },
    }),
    repos.payments.find({
      where: [brand, eq<Payment>('locationId', locationId), eq('businessDate', day)],
    }),
    getSettings(repos, brandId, locationId),
  ]);
  const byOrder = new Map<string, Payment[]>();
  for (const p of payments) byOrder.set(p.orderId, [...(byOrder.get(p.orderId) ?? []), p]);
  const rows: DailyRow[] = orders.map((o) => {
    const methods = [
      ...new Set((byOrder.get(o.id) ?? []).filter((p) => p.amountCents > 0).map((p) => p.method)),
    ];
    return {
      orderId: o.id,
      number: o.number,
      completedAt: o.completedAt,
      plate: o.plateDisplay,
      customer: o.customerName,
      services: summarizeLines(o.lines),
      method: methods.length > 1 ? 'SPLIT' : (methods[0] ?? '—'),
      totalCents: o.totalCents,
      discountCents: o.discountCents + o.loyaltyDiscountCents,
    };
  });
  const byMethod = (m: string) =>
    sum(payments.filter((p) => p.method === m).map((p) => p.amountCents));
  const cashCents = byMethod('CASH');
  const cardCents = byMethod('CARD');
  const otherCents = sum(
    payments.filter((p) => p.method !== 'CASH' && p.method !== 'CARD').map((p) => p.amountCents),
  );
  return {
    date: day,
    locationId,
    business: settings.business,
    rows,
    totals: {
      vehicles: rows.length,
      cashCents,
      cardCents,
      otherCents,
      refundsCents: -sum(payments.filter((p) => p.amountCents < 0).map((p) => p.amountCents)),
      grandTotalCents: cashCents + cardCents + otherCents,
      discountsCents: sum(rows.map((r) => r.discountCents)),
    },
    target: settings.dailyVehicleTarget,
  };
}

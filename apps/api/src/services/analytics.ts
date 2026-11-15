import {
  addDays,
  analyticsWindow,
  businessDate,
  dayOfWeek,
  isOpen,
  retention,
  salesStats,
  summarize,
  zonedHour,
  type AnalyticsPeriod,
  type Order,
} from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { eq, type Repositories } from '../repos';
import { getSettings } from './config';
import { locationTimezone } from './orders';

async function completedSince(repos: Repositories, ctx: Ctx, locationId: string, from?: string) {
  const where = [
    eq<Order>('brandId', ctx.actor.brandId),
    eq<Order>('locationId', locationId),
    eq<Order>('status', 'COMPLETED'),
  ];
  if (from) where.push({ field: 'businessDate', op: '>=', value: from });
  return repos.orders.find({ where });
}

export async function analytics(
  repos: Repositories,
  ctx: Ctx,
  locationId: string,
  q: { period: AnalyticsPeriod; from?: string; to?: string; item?: string },
) {
  const tz = await locationTimezone(repos, ctx.actor.brandId, locationId);
  let w;
  try {
    w = analyticsWindow(
      q.period,
      businessDate(ctx.now, tz),
      q.from && q.to ? { from: q.from, to: q.to } : undefined,
    );
  } catch (e) {
    throw new AppError('VALIDATION_FAILED', (e as Error).message);
  }
  // Retention needs all history to know which plates were seen before; sales only the two windows.
  const orders = await completedSince(repos, ctx, locationId);
  return { sales: salesStats(orders, w, q.item ?? null), retention: retention(orders, w) };
}

/** Owner dashboard: today vs the same weekday last week, target, open cars and a 7×24 heatmap. */
export async function dashboard(repos: Repositories, ctx: Ctx, locationId: string) {
  const tz = await locationTimezone(repos, ctx.actor.brandId, locationId);
  const today = businessDate(ctx.now, tz);
  const lastWeek = addDays(today, -7);
  const since = addDays(today, -27);
  const [orders, settings, open] = await Promise.all([
    completedSince(repos, ctx, locationId, since),
    getSettings(repos, ctx.actor.brandId, locationId),
    repos.orders.find({
      where: [
        eq<Order>('brandId', ctx.actor.brandId),
        eq<Order>('locationId', locationId),
        eq<Order>('businessDate', today),
      ],
    }),
  ]);
  const nowHour = zonedHour(ctx.now, tz);
  // Same weekday last week, up to the same hour (a fair "so far today" comparison).
  const lastWeekSoFar = orders.filter(
    (o) =>
      o.businessDate === lastWeek &&
      o.completedAt &&
      zonedHour(new Date(o.completedAt), tz) <= nowHour,
  );
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const o of orders) {
    if (!o.completedAt) continue;
    heat[dayOfWeek(o.businessDate)]![zonedHour(new Date(o.completedAt), tz)]! += o.totalCents;
  }
  const todaySummary = summarize(orders.filter((o) => o.businessDate === today));
  return {
    date: today,
    today: todaySummary,
    lastWeek: summarize(lastWeekSoFar),
    target: { completed: todaySummary.count, target: settings.dailyVehicleTarget },
    openOrders: open.filter((o) => isOpen(o.status)).length,
    heatmap: { since, cents: heat },
  };
}

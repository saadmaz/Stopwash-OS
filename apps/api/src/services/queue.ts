import {
  businessDate,
  canMoveTo,
  isOpen,
  plateKey,
  queueSort,
  type Order,
  type OrderStatus,
} from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { assertLocation } from '../lib/guard';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { getSettings } from './config';
import { locationTimezone } from './orders';

export interface QueueQuery {
  date?: string;
  status?: OrderStatus | 'OPEN';
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface QueuePage {
  items: Order[];
  total: number;
  page: number;
  pageCount: number;
  date: string;
  target: { completed: number; target: number };
}

/**
 * The live queue for one location and business day: that day's orders plus any still-open orders
 * from earlier days (so nothing falls off the board overnight).
 */
export async function listQueue(
  repos: Pick<Repositories, 'orders' | 'settings' | 'locations'>,
  ctx: Ctx,
  locationId: string,
  q: QueueQuery,
): Promise<QueuePage> {
  const brandId = ctx.actor.brandId;
  const tz = await locationTimezone(repos, brandId, locationId);
  const today = businessDate(ctx.now, tz);
  const date = q.date ?? today;
  const scope = [eq<Order>('brandId', brandId), eq<Order>('locationId', locationId)];
  const [day, open, settings] = await Promise.all([
    repos.orders.find({ where: [...scope, eq('businessDate', date)] }),
    date === today
      ? repos.orders.find({
          where: [
            ...scope,
            { field: 'status', op: 'in', value: ['QUEUED', 'IN_PROGRESS', 'READY'] },
            { field: 'businessDate', op: '<', value: date },
          ],
        })
      : Promise.resolve([]),
    getSettings(repos, brandId, locationId),
  ]);
  let rows = [...open, ...day];
  if (q.status === 'OPEN') rows = rows.filter((o) => isOpen(o.status));
  else if (q.status) rows = rows.filter((o) => o.status === q.status);
  const term = q.q?.trim().toLowerCase();
  if (term?.startsWith('#')) {
    // "#12" means ticket 12 only
    rows = rows.filter((o) => String(o.ticket) === term.slice(1));
  } else if (term) {
    const key = plateKey(term);
    const digits = term.replace(/\D/g, '');
    rows = rows.filter(
      (o) =>
        (key && o.plateKey.includes(key)) ||
        o.customerName?.toLowerCase().includes(term) ||
        (digits.length >= 3 &&
          o.customerPhone?.replace(/\D/g, '').includes(digits.replace(/^0/, ''))) ||
        String(o.ticket) === term ||
        o.number?.toLowerCase() === term,
    );
  }
  rows.sort(queueSort);
  const pageSize = Math.min(Math.max(q.pageSize ?? 10, 1), 100);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(q.page ?? 1, 1), pageCount);
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageCount,
    date,
    target: {
      completed: day.filter((o) => o.status === 'COMPLETED').length,
      target: settings.dailyVehicleTarget,
    },
  };
}

/** Floor status change (attendant phone / counter). COMPLETED goes through checkout instead. */
export async function setOrderStatus(
  tx: Repositories,
  ctx: Ctx,
  orderId: string,
  to: OrderStatus,
  reason: string | null,
): Promise<Order> {
  const order = await tx.orders.get(orderId);
  if (!order || order.brandId !== ctx.actor.brandId)
    throw new AppError('NOT_FOUND', 'Order not found');
  assertLocation(ctx, order.locationId);
  if (!canMoveTo(order.status, to)) {
    throw new AppError('ORDER_INVALID_TRANSITION', `Cannot move from ${order.status} to ${to}`);
  }
  if (to === 'CANCELLED' && !reason)
    throw new AppError('VALIDATION_FAILED', 'A reason is required to cancel');
  const at = ctx.now.toISOString();
  const updated = await tx.orders.update(order.id, {
    status: to,
    statusHistory: [...order.statusHistory, { status: to, at, by: ctx.actor.id }],
    cancelReason: to === 'CANCELLED' ? reason : order.cancelReason,
    updatedAt: at,
    updatedBy: ctx.actor.id,
  });
  await audit(tx, ctx, {
    action: to === 'CANCELLED' ? 'order.cancel' : 'order.status',
    entity: 'order',
    entityId: order.id,
    locationId: order.locationId,
    before: { status: order.status },
    after: { status: to },
    reason,
  });
  return updated;
}

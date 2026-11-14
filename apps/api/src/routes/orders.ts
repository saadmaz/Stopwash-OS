import { can, CheckoutInput, CreateOrderInput, DateKeyField, OrderStatus } from '@stopwash/shared';
import { checkout, quoteOrder } from '../services/checkout';
import { getSettings } from '../services/config';
import { eq } from '../repos';
import { assertLocation } from '../lib/guard';
import { verifyOverride } from '../services/override';
import { AppError } from '../lib/errors';
import { listQueue, setOrderStatus } from '../services/queue';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import { createOrder } from '../services/orders';

const CreateBody = CreateOrderInput.extend({ locationId: z.string().optional() });

const QueueQuery = z.object({
  locationId: z.string().optional(),
  date: DateKeyField.optional(),
  status: z.union([OrderStatus, z.literal('OPEN')]).optional(),
  q: z.string().max(40).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const QuoteQuery = z.object({ discountCents: z.coerce.number().int().nonnegative().default(0) });

const StatusBody = z.object({
  status: OrderStatus,
  reason: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null),
});

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.post('/orders', { preHandler: guard('order.create') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const key = idempotencyKeyOf(req);
    const body = validate(CreateBody, req.body);
    const locationId = resolveLocation(ctx, body.locationId);
    const { result, replayed } = await idempotent(
      app.store,
      ctx,
      'POST /orders',
      key,
      req.body,
      (tx) => createOrder(tx, ctx, locationId, body),
    );
    return reply
      .status(replayed ? 200 : 201)
      .header('idempotent-replay', String(replayed))
      .send(result);
  });

  app.get('/orders', { preHandler: guard('order.read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = validate(QueueQuery, req.query);
    return listQueue(app.store, ctx, resolveLocation(ctx, q.locationId), q);
  });

  app.post('/orders/:id/status', { preHandler: guard('order.status') }, async (req) => {
    const ctx = ctxOf(req);
    const key = idempotencyKeyOf(req);
    const body = validate(StatusBody, req.body);
    if (body.status === 'CANCELLED' && !can(ctx.actor.role, 'order.cancel')) {
      throw new AppError('FORBIDDEN', 'Only a manager can cancel orders');
    }
    const { id } = req.params as { id: string };
    const route = `POST /orders/${id}/status`;
    const { result } = await idempotent(app.store, ctx, route, key, req.body, (tx) =>
      setOrderStatus(tx, ctx, id, body.status, body.reason),
    );
    return result;
  });

  app.post('/orders/:id/checkout', { preHandler: guard('order.checkout') }, async (req) => {
    const ctx = ctxOf(req);
    const key = idempotencyKeyOf(req);
    const body = validate(CheckoutInput, req.body);
    const { id } = req.params as { id: string };
    // Verify any approval first, outside the transaction, so failed PINs still count to lockout.
    const order = await app.store.orders.get(id);
    const approver =
      body.override && order
        ? await verifyOverride(
            app.store,
            ctx,
            order.locationId,
            body.override,
            'order.discount.override',
            {
              maxAttempts: app.env.PIN_MAX_ATTEMPTS,
              lockoutMinutes: app.env.PIN_LOCKOUT_MINUTES,
            },
          )
        : null;
    const route = 'POST /orders/' + id + '/checkout';
    const { result } = await idempotent(app.store, ctx, route, key, req.body, (tx) =>
      checkout(tx, ctx, id, body, approver),
    );
    return result;
  });

  async function orderFor(req: Parameters<typeof ctxOf>[0]) {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const order = await app.store.orders.get(id);
    if (!order || order.brandId !== ctx.actor.brandId)
      throw new AppError('NOT_FOUND', 'Order not found');
    assertLocation(ctx, order.locationId);
    return { ctx, order };
  }

  app.get(
    '/orders/:id',
    { preHandler: guard('order.read') },
    async (req) => (await orderFor(req)).order,
  );

  /** Exact total to collect (loyalty, discount and tax applied) before taking payment. */
  app.get('/orders/:id/quote', { preHandler: guard('order.checkout') }, async (req) => {
    const { ctx, order } = await orderFor(req);
    const { discountCents } = validate(QuoteQuery, req.query);
    const q = await quoteOrder(app.store, ctx, order, discountCents);
    return {
      subtotalCents: q.priced.subtotalCents,
      loyaltyDiscountCents: q.priced.loyaltyDiscountCents,
      discountCents: q.priced.discountCents,
      taxCents: q.priced.taxCents,
      totalCents: q.priced.totalCents,
      discountNeedsApproval: q.discountNeedsApproval,
    };
  });

  /** Everything needed to show or reprint a receipt. */
  app.get('/orders/:id/receipt', { preHandler: guard('order.read') }, async (req) => {
    const { ctx, order } = await orderFor(req);
    if (order.status !== 'COMPLETED')
      throw new AppError('ORDER_NOT_EDITABLE', 'Order is not paid yet');
    const [payments, settings] = await Promise.all([
      app.store.payments.find({
        where: [eq('brandId', ctx.actor.brandId), eq('orderId', order.id)],
        orderBy: { field: 'createdAt' },
      }),
      getSettings(app.store, ctx.actor.brandId, order.locationId),
    ]);
    return { order, payments, business: settings.business, footer: settings.receipt.footer };
  });
}

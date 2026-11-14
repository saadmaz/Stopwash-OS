import { can, CreateOrderInput, DateKeyField, OrderStatus } from '@stopwash/shared';
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
}

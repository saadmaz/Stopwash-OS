import { CreateOrderInput } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import { createOrder } from '../services/orders';

const CreateBody = CreateOrderInput.extend({ locationId: z.string().optional() });

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
}

import { LeaveInput } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { ctxOf, guard } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import {
  cancelLeave,
  decideLeave,
  LeaveDecision,
  listLeaves,
  requestLeave,
} from '../services/leave';

export async function leaveRoutes(app: FastifyInstance): Promise<void> {
  app.get('/leaves', { preHandler: guard('leave.request') }, async (req) => ({
    items: await listLeaves(app.store, ctxOf(req)),
  }));

  app.post('/leaves', { preHandler: guard('leave.request') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const body = validate(LeaveInput, req.body);
    const { result } = await idempotent(
      app.store,
      ctx,
      'POST /leaves',
      idempotencyKeyOf(req),
      req.body,
      (tx) => requestLeave(tx, ctx, body),
    );
    return reply.status(201).send(result);
  });

  app.post('/leaves/:id/decision', { preHandler: guard('leave.approve') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const body = validate(LeaveDecision, req.body);
    const route = `POST /leaves/${id}/decision`;
    const { result } = await idempotent(
      app.store,
      ctx,
      route,
      idempotencyKeyOf(req),
      req.body,
      (tx) => decideLeave(tx, ctx, id, body),
    );
    return result;
  });

  app.post('/leaves/:id/cancel', { preHandler: guard('leave.request') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const route = `POST /leaves/${id}/cancel`;
    const { result } = await idempotent(
      app.store,
      ctx,
      route,
      idempotencyKeyOf(req),
      req.body ?? {},
      (tx) => cancelLeave(tx, ctx, id),
    );
    return result;
  });
}

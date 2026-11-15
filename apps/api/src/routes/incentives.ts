import { IncentiveRuleInput } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import { createRule, listRules, RulePatch, updateRule } from '../services/incentives';

export async function incentiveRoutes(app: FastifyInstance): Promise<void> {
  app.get('/incentive-rules', { preHandler: guard('employee.read') }, async (req) => {
    const q = validate(
      z.object({ includeArchived: z.enum(['true', 'false']).optional() }),
      req.query,
    );
    return { items: await listRules(app.store, ctxOf(req), q.includeArchived === 'true') };
  });

  app.post('/incentive-rules', { preHandler: guard('incentive.write') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const body = validate(IncentiveRuleInput, req.body);
    const key = idempotencyKeyOf(req);
    const { result } = await idempotent(
      app.store,
      ctx,
      'POST /incentive-rules',
      key,
      req.body,
      (tx) => createRule(tx, ctx, body),
    );
    return reply.status(201).send(result);
  });

  app.patch('/incentive-rules/:id', { preHandler: guard('incentive.write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const body = validate(RulePatch, req.body);
    const key = idempotencyKeyOf(req);
    const route = `PATCH /incentive-rules/${id}`;
    const { result } = await idempotent(app.store, ctx, route, key, req.body, (tx) =>
      updateRule(tx, ctx, id, body),
    );
    return result;
  });
}

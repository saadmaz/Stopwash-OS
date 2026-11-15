import { PeriodKeyField } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import {
  addAdjustment,
  AdjustmentInput,
  listAdjustments,
  reverseAdjustment,
} from '../services/payroll-adjustments';
import { finalizePayroll, listRuns, previewPayroll } from '../services/payroll-runs';

export async function payrollRoutes(app: FastifyInstance): Promise<void> {
  app.get('/payroll/preview', { preHandler: guard('payroll.read') }, async (req) => {
    const { period } = validate(z.object({ period: PeriodKeyField }), req.query);
    return previewPayroll(app.store, ctxOf(req), period);
  });

  app.get('/payroll/runs', { preHandler: guard('payroll.read') }, async (req) => {
    const { period } = validate(z.object({ period: PeriodKeyField.optional() }), req.query);
    return { items: await listRuns(app.store, ctxOf(req).actor.brandId, period) };
  });

  app.post('/payroll/runs', { preHandler: guard('payroll.finalize') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const body = validate(
      z.object({
        period: PeriodKeyField,
        kind: z.enum(['REGULAR', 'SUPPLEMENTARY']).default('REGULAR'),
      }),
      req.body,
    );
    const key = idempotencyKeyOf(req);
    const { result } = await idempotent(app.store, ctx, 'POST /payroll/runs', key, req.body, (tx) =>
      finalizePayroll(tx, ctx, body.period, body.kind),
    );
    return reply.status(201).send(result);
  });

  app.get('/payroll-adjustments', { preHandler: guard('payroll.read') }, async (req) => {
    const q = validate(
      z.object({ period: PeriodKeyField, employeeId: z.string().optional() }),
      req.query,
    );
    return {
      items: await listAdjustments(app.store, ctxOf(req).actor.brandId, q.period, q.employeeId),
    };
  });

  app.post('/payroll-adjustments', { preHandler: guard('payroll.adjust') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const body = validate(AdjustmentInput, req.body);
    const key = idempotencyKeyOf(req);
    const { result } = await idempotent(
      app.store,
      ctx,
      'POST /payroll-adjustments',
      key,
      req.body,
      (tx) => addAdjustment(tx, ctx, body),
    );
    return reply.status(201).send(result);
  });

  app.post(
    '/payroll-adjustments/:id/reverse',
    { preHandler: guard('payroll.adjust') },
    async (req) => {
      const ctx = ctxOf(req);
      const { id } = req.params as { id: string };
      const { reason } = validate(
        z.object({ reason: z.string().trim().min(1).max(200) }),
        req.body,
      );
      const route = `POST /payroll-adjustments/${id}/reverse`;
      const { result } = await idempotent(
        app.store,
        ctx,
        route,
        idempotencyKeyOf(req),
        req.body,
        (tx) => reverseAdjustment(tx, ctx, id, reason),
      );
      return result;
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import { ChecklistInput, stockStatus, submitChecklist } from '../services/checklists';
import { currentShift, openShift, OpenShiftInput } from '../services/shifts';

const Loc = z.object({ locationId: z.string().optional() });

export async function shiftRoutes(app: FastifyInstance): Promise<void> {
  app.post('/checklists', { preHandler: guard('checklist.submit') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const key = idempotencyKeyOf(req);
    const body = validate(ChecklistInput.extend(Loc.shape), req.body);
    const locationId = resolveLocation(ctx, body.locationId);
    const { result } = await idempotent(app.store, ctx, 'POST /checklists', key, req.body, (tx) =>
      submitChecklist(tx, ctx, locationId, body),
    );
    return reply.status(201).send(result);
  });

  app.get('/stock-status', { preHandler: guard('shift.read') }, async (req) => {
    const ctx = ctxOf(req);
    const { locationId } = validate(Loc, req.query);
    return stockStatus(app.store, ctx.actor.brandId, resolveLocation(ctx, locationId));
  });

  app.post('/shifts', { preHandler: guard('shift.open') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const key = idempotencyKeyOf(req);
    const body = validate(OpenShiftInput.extend(Loc.shape), req.body);
    const locationId = resolveLocation(ctx, body.locationId);
    const { result } = await idempotent(app.store, ctx, 'POST /shifts', key, req.body, (tx) =>
      openShift(tx, ctx, locationId, body),
    );
    return reply.status(201).send(result);
  });

  app.get('/shifts/current', { preHandler: guard('shift.read') }, async (req) => {
    const ctx = ctxOf(req);
    const { locationId } = validate(Loc, req.query);
    return {
      shift: await currentShift(app.store, ctx.actor.brandId, resolveLocation(ctx, locationId)),
    };
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import { ChecklistInput, stockStatus, submitChecklist } from '../services/checklists';
import { currentShift, openShift, OpenShiftInput } from '../services/shifts';
import { AppError } from '../lib/errors';
import { verifyOverride } from '../services/override';
import { closeShift, CloseShiftInput, loadShift, shiftSummary } from '../services/shift-close';

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

  app.get('/shifts/:id/summary', { preHandler: guard('shift.read') }, async (req) => {
    const ctx = ctxOf(req);
    return shiftSummary(app.store, ctx, (req.params as { id: string }).id);
  });

  app.post('/shifts/:id/close', { preHandler: guard('shift.close') }, async (req) => {
    const ctx = ctxOf(req);
    const key = idempotencyKeyOf(req);
    const body = validate(CloseShiftInput, req.body);
    const { id } = req.params as { id: string };
    const shift = await loadShift(app.store, ctx, id);
    if (body.handover.employeeId === ctx.actor.employeeId) {
      throw new AppError(
        'HANDOVER_REQUIRED',
        'The incoming supervisor must sign off, not the person closing',
      );
    }
    const policy = {
      maxAttempts: app.env.PIN_MAX_ATTEMPTS,
      lockoutMinutes: app.env.PIN_LOCKOUT_MINUTES,
    };
    // PINs are checked before the transaction so failed attempts count (D-034).
    const handover = await verifyOverride(
      app.store,
      ctx,
      shift.locationId,
      body.handover,
      'shift.open',
      policy,
    );
    const override = body.override
      ? await verifyOverride(
          app.store,
          ctx,
          shift.locationId,
          body.override,
          'shift.close.override',
          policy,
        )
      : null;
    const route = 'POST /shifts/' + id + '/close';
    return (
      await idempotent(app.store, ctx, route, key, req.body, (tx) =>
        closeShift(tx, ctx, id, body, handover, override),
      )
    ).result;
  });
}

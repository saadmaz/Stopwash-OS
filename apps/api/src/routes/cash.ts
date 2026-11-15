import { can } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import {
  CashMovementInput,
  listCashMovements,
  needsCashApproval,
  recordCashMovement,
  reverseCashMovement,
} from '../services/cash';
import { verifyOverride } from '../services/override';
import { currentShift } from '../services/shifts';

const Loc = z.object({ locationId: z.string().optional() });
const Target = z.object({ targetShiftId: z.string().optional() });

export async function cashRoutes(app: FastifyInstance): Promise<void> {
  const policy = () => ({
    maxAttempts: app.env.PIN_MAX_ATTEMPTS,
    lockoutMinutes: app.env.PIN_LOCKOUT_MINUTES,
  });

  app.post('/cash-movements', { preHandler: guard('cash.create') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const key = idempotencyKeyOf(req);
    const body = validate(CashMovementInput.extend(Loc.shape).extend(Target.shape), req.body);
    const locationId = resolveLocation(ctx, body.locationId);
    if (body.targetShiftId && !can(ctx.actor.role, 'shift.backdate')) {
      throw new AppError('FORBIDDEN', 'Only a manager can add back-dated entries');
    }
    const needs = await needsCashApproval(
      app.store,
      ctx.actor.brandId,
      locationId,
      body.amountCents,
    );
    const approver =
      needs && body.override
        ? await verifyOverride(app.store, ctx, locationId, body.override, 'cash.approve', policy())
        : null;
    const { result } = await idempotent(
      app.store,
      ctx,
      'POST /cash-movements',
      key,
      req.body,
      (tx) => recordCashMovement(tx, ctx, locationId, body, approver, body.targetShiftId),
    );
    return reply.status(201).send(result);
  });

  app.post('/cash-movements/:id/reverse', { preHandler: guard('cash.reverse') }, async (req) => {
    const ctx = ctxOf(req);
    const key = idempotencyKeyOf(req);
    const { reason } = validate(z.object({ reason: z.string().trim().min(1).max(200) }), req.body);
    const { id } = req.params as { id: string };
    const route = 'POST /cash-movements/' + id + '/reverse';
    return (
      await idempotent(app.store, ctx, route, key, req.body, (tx) =>
        reverseCashMovement(tx, ctx, id, reason),
      )
    ).result;
  });

  /** Cash entries for the current shift (or a given one). */
  app.get('/cash-movements', { preHandler: guard('cash.read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = validate(Loc.extend({ shiftId: z.string().optional() }), req.query);
    const shiftId =
      q.shiftId ??
      (await currentShift(app.store, ctx.actor.brandId, resolveLocation(ctx, q.locationId)))?.id;
    return { items: shiftId ? await listCashMovements(app.store, ctx.actor.brandId, shiftId) : [] };
  });
}

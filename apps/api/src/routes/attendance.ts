import { DateKeyField } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import {
  attendanceReport,
  markAttendance,
  MarkAttendanceInput,
  roster,
} from '../services/attendance';

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/attendance', { preHandler: guard('attendance.read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = validate(
      z.object({ date: DateKeyField, locationId: z.string().optional() }),
      req.query,
    );
    return {
      date: q.date,
      items: await roster(app.store, ctx, resolveLocation(ctx, q.locationId), q.date),
    };
  });

  app.put('/attendance', { preHandler: guard('attendance.write') }, async (req) => {
    const ctx = ctxOf(req);
    const body = validate(
      MarkAttendanceInput.extend({ locationId: z.string().optional() }),
      req.body,
    );
    const locationId = resolveLocation(ctx, body.locationId);
    const { result } = await idempotent(
      app.store,
      ctx,
      'PUT /attendance',
      idempotencyKeyOf(req),
      req.body,
      async (tx) => ({
        saved: await markAttendance(tx, ctx, locationId, body),
      }),
    );
    return result;
  });

  app.get('/attendance/report', { preHandler: guard('attendance.read') }, async (req) => {
    const q = validate(z.object({ from: DateKeyField, to: DateKeyField }), req.query);
    return { items: await attendanceReport(app.store, ctxOf(req).actor.brandId, q.from, q.to) };
  });
}

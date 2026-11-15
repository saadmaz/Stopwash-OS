import { DateKeyField } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { validate } from '../lib/validate';
import { dailyReport } from '../services/reports';

const Q = z.object({ locationId: z.string().optional(), date: DateKeyField.optional() });

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports/daily', { preHandler: guard('report.read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = validate(Q, req.query);
    return dailyReport(app.store, ctx, resolveLocation(ctx, q.locationId), q.date);
  });
}

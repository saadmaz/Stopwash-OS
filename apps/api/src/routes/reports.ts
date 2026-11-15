import { DateKeyField } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { validate } from '../lib/validate';
import { dailyReport, ordersCsv } from '../services/reports';

const Q = z.object({ locationId: z.string().optional(), date: DateKeyField.optional() });

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports/daily', { preHandler: guard('report.read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = validate(Q, req.query);
    return dailyReport(app.store, ctx, resolveLocation(ctx, q.locationId), q.date);
  });

  /** Master CSV of completed orders (SWOMS columns), optionally limited to a date range. */
  app.get('/reports/orders.csv', { preHandler: guard('report.export') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const q = validate(
      z.object({
        locationId: z.string().optional(),
        from: DateKeyField.optional(),
        to: DateKeyField.optional(),
      }),
      req.query,
    );
    const csv = await ordersCsv(app.store, ctx, resolveLocation(ctx, q.locationId), q.from, q.to);
    const name = `Completed_Orders_${q.from ?? 'all'}_${q.to ?? 'to-date'}.csv`;
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${name}"`)
      .send(String.fromCharCode(0xfeff) + csv); // BOM so Excel reads Sinhala/Tamil names
  });
}

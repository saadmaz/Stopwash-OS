import type { Alert } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { assertLocation, ctxOf, guard, resolveLocation } from '../lib/guard';
import { validate } from '../lib/validate';
import { eq } from '../repos';
import { audit } from '../services/audit';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Manager alerts (variance, low stock, equipment faults). The web polls this and shows a toast
 * for anything new; acknowledging is per person and only appends the reader's id.
 */
export async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.get('/alerts', { preHandler: guard('alert.read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = validate(z.object({ locationId: z.string().optional() }), req.query);
    const locationId = resolveLocation(ctx, q.locationId);
    const since = new Date(ctx.now.getTime() - WINDOW_MS).toISOString();
    const rows = await app.store.alerts.find({
      where: [
        eq<Alert>('brandId', ctx.actor.brandId),
        eq<Alert>('locationId', locationId),
        { field: 'createdAt', op: '>=', value: since },
      ],
      orderBy: { field: 'createdAt', dir: 'desc' },
      limit: 50,
    });
    return { items: rows.filter((a) => !a.acknowledgedBy.includes(ctx.actor.id)) };
  });

  app.post('/alerts/:id/ack', { preHandler: guard('alert.read') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    return app.store.transaction(async (tx) => {
      const alert = await tx.alerts.get(id);
      if (!alert || alert.brandId !== ctx.actor.brandId) {
        throw new AppError('NOT_FOUND', 'Alert not found');
      }
      assertLocation(ctx, alert.locationId);
      if (alert.acknowledgedBy.includes(ctx.actor.id)) return { ok: true };
      await tx.alerts.update(id, { acknowledgedBy: [...alert.acknowledgedBy, ctx.actor.id] });
      await audit(tx, ctx, { action: 'alert.ack', entity: 'alert', entityId: id });
      return { ok: true };
    });
  });
}

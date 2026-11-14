import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { validate } from '../lib/validate';
import { getConfig } from '../services/config';

const Query = z.object({
  locationId: z.string().optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/config', { preHandler: guard('settings.read') }, async (req) => {
    const ctx = ctxOf(req);
    const q = validate(Query, req.query);
    const locationId = resolveLocation(ctx, q.locationId);
    return getConfig(app.store, ctx.actor.brandId, locationId, q.includeInactive);
  });
}

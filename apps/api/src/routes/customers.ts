import { plateKey } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { ctxOf, guard } from '../lib/guard';
import { validate } from '../lib/validate';
import { lookup, vehicleId } from '../services/customers';
import { eq } from '../repos';

const LookupQuery = z.object({
  plate: z.string().max(24).optional(),
  phone: z.string().max(20).optional(),
  name: z.string().max(80).optional(),
});

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  /** Typeahead for the order form (plate, phone or name prefix). */
  app.get('/lookup', { preHandler: guard('customer.read') }, async (req) => {
    const ctx = ctxOf(req);
    return lookup(app.store, ctx.actor.brandId, validate(LookupQuery, req.query));
  });

  /** One vehicle by plate, with its customer and last 50 orders (vehicle history). */
  app.get('/vehicles/:plate', { preHandler: guard('customer.read') }, async (req) => {
    const ctx = ctxOf(req);
    const key = plateKey((req.params as { plate: string }).plate);
    const vehicle = await app.store.vehicles.get(vehicleId(ctx.actor.brandId, key));
    if (!vehicle || vehicle.brandId !== ctx.actor.brandId) {
      throw new AppError('NOT_FOUND', 'No visits for this plate yet');
    }
    const [customer, orders] = await Promise.all([
      vehicle.customerId ? app.store.customers.get(vehicle.customerId) : null,
      // Firestore: needs a composite index on orders (brandId, plateKey, createdAt desc).
      app.store.orders.find({
        where: [eq('brandId', ctx.actor.brandId), eq('plateKey', key)],
        orderBy: { field: 'createdAt', dir: 'desc' },
        limit: 50,
      }),
    ]);
    return { vehicle, customer, orders };
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from '../repos';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import {
  createInvoice,
  CreateInvoiceInput,
  listInvoices,
  settle,
  SettleInput,
  voidInvoice,
} from '../services/invoices';

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/invoices', { preHandler: guard('invoice.read') }, async (req) => ({
    items: await listInvoices(app.store, ctxOf(req).actor.brandId),
  }));

  app.get('/billing-customers', { preHandler: guard('invoice.read') }, async (req) => ({
    items: await app.store.billingCustomers.find({
      where: [eq('brandId', ctxOf(req).actor.brandId)],
      orderBy: { field: 'name' },
    }),
  }));

  app.post('/invoices', { preHandler: guard('invoice.write') }, async (req, reply) => {
    const ctx = ctxOf(req);
    const raw = req.body as { locationId?: string } | undefined;
    const body = validate(CreateInvoiceInput, req.body);
    const locationId = resolveLocation(ctx, raw?.locationId);
    const key = idempotencyKeyOf(req);
    const { result } = await idempotent(app.store, ctx, 'POST /invoices', key, req.body, (tx) =>
      createInvoice(tx, ctx, locationId, body),
    );
    return reply.status(201).send(result);
  });

  app.post('/invoices/:id/settle', { preHandler: guard('invoice.write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const body = validate(SettleInput, req.body);
    const key = idempotencyKeyOf(req);
    const route = `POST /invoices/${id}/settle`;
    return (
      await idempotent(app.store, ctx, route, key, req.body, (tx) => settle(tx, ctx, id, body))
    ).result;
  });

  app.post('/invoices/:id/void', { preHandler: guard('invoice.write') }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const { reason } = validate(z.object({ reason: z.string().trim().min(1).max(200) }), req.body);
    const key = idempotencyKeyOf(req);
    const route = `POST /invoices/${id}/void`;
    return (
      await idempotent(app.store, ctx, route, key, req.body, (tx) =>
        voidInvoice(tx, ctx, id, reason),
      )
    ).result;
  });
}

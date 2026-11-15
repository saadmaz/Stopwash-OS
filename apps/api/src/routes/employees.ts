import { Pin } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ctxOf, guard } from '../lib/guard';
import { idempotencyKeyOf, idempotent } from '../lib/idempotency';
import { validate } from '../lib/validate';
import {
  createEmployee,
  CreateEmployeeInput,
  ExemptInput,
  listEmployees,
  resetPin,
  setExempt,
  updateEmployee,
  UpdateEmployeeInput,
} from '../services/employees';

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  const run = <R>(
    req: Parameters<typeof ctxOf>[0],
    route: string,
    fn: (tx: Parameters<Parameters<typeof idempotent>[5]>[0]) => Promise<R>,
  ) =>
    idempotent(app.store, ctxOf(req), route, idempotencyKeyOf(req), req.body, fn).then(
      (r) => r.result,
    );

  app.get('/employees', { preHandler: guard('employee.read') }, async (req) => {
    const q = validate(
      z.object({ includeInactive: z.enum(['true', 'false']).optional() }),
      req.query,
    );
    return { items: await listEmployees(app.store, ctxOf(req), q.includeInactive === 'true') };
  });

  app.post('/employees', { preHandler: guard('employee.write') }, async (req, reply) => {
    const body = validate(CreateEmployeeInput, req.body);
    const ctx = ctxOf(req);
    return reply
      .status(201)
      .send(await run(req, 'POST /employees', (tx) => createEmployee(tx, ctx, body)));
  });

  app.patch('/employees/:id', { preHandler: guard('employee.write') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = validate(UpdateEmployeeInput, req.body);
    const ctx = ctxOf(req);
    return run(req, 'PATCH /employees/' + id, (tx) => updateEmployee(tx, ctx, id, body));
  });

  app.post('/employees/:id/pin', { preHandler: guard('employee.pin.reset') }, async (req) => {
    const { id } = req.params as { id: string };
    const { pin } = validate(z.object({ pin: Pin }), req.body);
    const ctx = ctxOf(req);
    await run(req, 'POST /employees/' + id + '/pin', async (tx) => {
      await resetPin(tx, ctx, id, pin);
      return { ok: true };
    });
    return { ok: true };
  });

  app.post('/employees/:id/exempt', { preHandler: guard('employee.write') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = validate(ExemptInput, req.body);
    const ctx = ctxOf(req);
    return run(req, 'POST /employees/' + id + '/exempt', (tx) => setExempt(tx, ctx, id, body));
  });
}

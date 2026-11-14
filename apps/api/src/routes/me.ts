import { permissionsOf } from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { ctxOf, guard } from '../lib/guard';

export async function meRoutes(app: FastifyInstance): Promise<void> {
  /** Who am I, and what may I do? The web app builds its navigation from this. */
  app.get('/me', { preHandler: guard() }, async (req) => {
    const { actor } = ctxOf(req);
    return { user: actor, permissions: permissionsOf(actor.role) };
  });
}

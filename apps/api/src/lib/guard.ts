import { can, canAccessLocation, type Permission } from '@stopwash/shared';
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { Ctx } from './context';
import { AppError } from './errors';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `guard()`. Undefined on public routes. */
    ctx?: Ctx;
  }
}

/** Verifies the bearer token and returns the request context. */
async function authenticate(req: FastifyRequest): Promise<Ctx> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError('UNAUTHENTICATED', 'Sign in required');
  const s = await req.server.tokens.verify(header.slice(7).trim());
  return {
    actor: {
      id: s.uid,
      name: s.name,
      role: s.role,
      brandId: s.brandId,
      locationIds: s.locationIds,
      employeeId: s.employeeId ?? null,
      deviceId: s.deviceId ?? null,
    },
    requestId: req.id,
    now: new Date(),
  };
}

/**
 * Route option: `{ preHandler: guard('order.create') }`. Authenticates, then checks the
 * role's permission from the shared RBAC map (the same map the web app uses).
 */
export function guard(...permissions: Permission[]): preHandlerAsyncHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const ctx = await authenticate(req);
    const missing = permissions.filter((p) => !can(ctx.actor.role, p));
    if (missing.length) {
      throw new AppError('FORBIDDEN', `Your role can't do this (${missing.join(', ')})`);
    }
    req.ctx = ctx;
  };
}

/** The verified context; only call inside a guarded route. */
export function ctxOf(req: FastifyRequest): Ctx {
  if (!req.ctx) throw new AppError('UNAUTHENTICATED', 'Sign in required');
  return req.ctx;
}

/** Throws unless the actor may act on this location. */
export function assertLocation(ctx: Ctx, locationId: string): void {
  const claims = { ...ctx.actor };
  if (!canAccessLocation(claims, locationId)) {
    throw new AppError('FORBIDDEN', 'You are not assigned to this location');
  }
}

/** The single location for counter actions: the request's, or the actor's only one. */
export function resolveLocation(ctx: Ctx, requested?: string | null): string {
  const loc = requested ?? (ctx.actor.locationIds.length === 1 ? ctx.actor.locationIds[0] : null);
  if (!loc) throw new AppError('BAD_REQUEST', 'locationId is required');
  assertLocation(ctx, loc);
  return loc;
}

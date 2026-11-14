import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DataStore, Repositories } from '../repos';
import type { Ctx } from './context';
import { AppError } from './errors';

const KEY = z.uuid();
const TTL_DAYS = 7;

/** Reads the Idempotency-Key header (required on money/state writes). */
export function idempotencyKeyOf(req: FastifyRequest): string {
  const raw = req.headers['idempotency-key'];
  const parsed = KEY.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!parsed.success)
    throw new AppError('BAD_REQUEST', 'Idempotency-Key header (UUID) is required');
  return parsed.data;
}

function stableHash(value: unknown): string {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
          )
        : v;
  return createHash('sha256')
    .update(JSON.stringify(canon(value)))
    .digest('hex');
}

/**
 * Runs `fn` exactly once per (actor, key). A retry with the same body gets the stored result;
 * the same key with a different body is rejected. The record is written in the same transaction
 * as the change, so a failed attempt leaves nothing behind and can be retried.
 */
export async function idempotent<R>(
  store: DataStore,
  ctx: Ctx,
  route: string,
  key: string,
  body: unknown,
  fn: (tx: Repositories) => Promise<R>,
): Promise<{ result: R; replayed: boolean }> {
  const id = `${ctx.actor.brandId}__${ctx.actor.id}__${key}`;
  const requestHash = stableHash({ route, body });
  return store.transaction(async (tx) => {
    const prior = await tx.idempotency.get(id);
    if (prior) {
      if (prior.requestHash !== requestHash || prior.route !== route) {
        throw new AppError(
          'IDEMPOTENCY_MISMATCH',
          'This request key was already used for a different request',
        );
      }
      return { result: prior.response as R, replayed: true };
    }
    const result = await fn(tx);
    await tx.idempotency.insert({
      id,
      brandId: ctx.actor.brandId,
      actorId: ctx.actor.id,
      route,
      requestHash,
      statusCode: 200,
      response: result,
      createdAt: ctx.now.toISOString(),
      expiresAt: new Date(ctx.now.getTime() + TTL_DAYS * 86_400_000).toISOString(),
    });
    return { result, replayed: false };
  });
}

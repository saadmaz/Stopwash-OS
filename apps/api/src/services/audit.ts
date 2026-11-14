import type { AuditEntry } from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { newId } from '../lib/ids';
import { eq, type Cond, type Repositories } from '../repos';

/** Field names never written to the audit log. */
const SECRET_KEYS = new Set([
  'pin',
  'pinHash',
  'secretHash',
  'deviceSecret',
  'overridePin',
  'password',
]);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.has(k) ? '[redacted]' : redact(v)]),
    );
  }
  return value;
}

export interface AuditInput {
  action: string;
  entity: string;
  entityId: string;
  locationId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** Write an audit entry. Pass the transaction's repositories so it commits with the change. */
export async function audit(
  tx: Pick<Repositories, 'audit'>,
  ctx: Ctx,
  input: AuditInput,
): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    locationId: input.locationId ?? null,
    at: ctx.now.toISOString(),
    actorId: ctx.actor.id,
    actorName: ctx.actor.name,
    actorRole: ctx.actor.role,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before === undefined ? null : redact(input.before),
    after: input.after === undefined ? null : redact(input.after),
    reason: input.reason ?? null,
    requestId: ctx.requestId,
    deviceId: ctx.actor.deviceId,
  };
  return tx.audit.insert(entry);
}

export interface AuditQuery {
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: string; // ISO, inclusive
  to?: string; // ISO, exclusive
  limit?: number;
  offset?: number;
}

export async function listAudit(
  repos: Pick<Repositories, 'audit'>,
  brandId: string,
  q: AuditQuery,
) {
  const where: Cond<AuditEntry>[] = [eq('brandId', brandId)];
  if (q.entity) where.push(eq('entity', q.entity));
  if (q.entityId) where.push(eq('entityId', q.entityId));
  if (q.actorId) where.push(eq('actorId', q.actorId));
  if (q.action) where.push(eq('action', q.action));
  if (q.from) where.push({ field: 'at', op: '>=', value: q.from });
  if (q.to) where.push({ field: 'at', op: '<', value: q.to });
  const opts = { where, orderBy: { field: 'at' as const, dir: 'desc' as const } };
  const [items, total] = await Promise.all([
    repos.audit.find({ ...opts, limit: Math.min(q.limit ?? 50, 200), offset: q.offset ?? 0 }),
    repos.audit.count(opts),
  ]);
  return { items, total };
}

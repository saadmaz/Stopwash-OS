import {
  can,
  CashCategoryInput,
  CatalogItemInput,
  ChecklistItemInput,
  Settings,
  type Permission,
} from '@stopwash/shared';
import type { FastifyInstance } from 'fastify';
import { type z } from 'zod';
import { AppError } from '../lib/errors';
import { ctxOf, guard, resolveLocation } from '../lib/guard';
import { validate } from '../lib/validate';
import type { Repositories } from '../repos';
import { audit } from '../services/audit';
import { settingsId } from '../services/defaults';

type ConfigRepoKey = 'catalog' | 'cashCategories' | 'checklistItems';

/** Create + update (no delete: set active=false) for a brand-level configuration collection. */
function configCrud(
  app: FastifyInstance,
  opts: {
    path: string;
    repo: ConfigRepoKey;
    entity: string;
    permission: Permission;
    schema: z.ZodObject;
    /** Builds a stable id from the input (codes are unique per brand). */
    idOf: (brandId: string, input: Record<string, unknown>) => string;
    immutable?: string[];
  },
) {
  const repo = (tx: Repositories) => tx[opts.repo] as unknown as Repositories['catalog'];

  app.post(opts.path, { preHandler: guard(opts.permission) }, async (req, reply) => {
    const ctx = ctxOf(req);
    const input = validate(opts.schema, req.body) as Record<string, unknown>;
    const at = ctx.now.toISOString();
    const doc = {
      ...input,
      id: opts.idOf(ctx.actor.brandId, input),
      brandId: ctx.actor.brandId,
      createdAt: at,
      createdBy: ctx.actor.id,
      updatedAt: null,
      updatedBy: null,
    } as never;
    const saved = await app.store.transaction(async (tx) => {
      const created = await repo(tx).insert(doc);
      await audit(tx, ctx, {
        action: `${opts.entity}.create`,
        entity: opts.entity,
        entityId: created.id,
        after: created,
      });
      return created;
    });
    return reply.status(201).send(saved);
  });

  app.patch(`${opts.path}/:id`, { preHandler: guard(opts.permission) }, async (req) => {
    const ctx = ctxOf(req);
    const { id } = req.params as { id: string };
    const patch = validate(opts.schema.partial(), req.body) as Record<string, unknown>;
    for (const f of opts.immutable ?? []) {
      if (f in patch) throw new AppError('BAD_REQUEST', `${f} cannot be changed`);
    }
    return app.store.transaction(async (tx) => {
      const before = await repo(tx).get(id);
      if (!before || before.brandId !== ctx.actor.brandId)
        throw new AppError('NOT_FOUND', 'Not found');
      const after = await repo(tx).update(id, {
        ...patch,
        updatedAt: ctx.now.toISOString(),
        updatedBy: ctx.actor.id,
      } as never);
      await audit(tx, ctx, {
        action: `${opts.entity}.update`,
        entity: opts.entity,
        entityId: id,
        before,
        after,
      });
      return after;
    });
  });
}

const codeId = (brandId: string, input: Record<string, unknown>) =>
  `${brandId}__${String(input.code).toLowerCase()}`;

export async function adminConfigRoutes(app: FastifyInstance): Promise<void> {
  configCrud(app, {
    path: '/catalog',
    repo: 'catalog',
    entity: 'catalogItem',
    permission: 'catalog.write',
    schema: CatalogItemInput,
    idOf: codeId,
    immutable: ['code', 'kind'],
  });
  configCrud(app, {
    path: '/cash-categories',
    repo: 'cashCategories',
    entity: 'cashCategory',
    permission: 'settings.write',
    schema: CashCategoryInput,
    idOf: codeId,
    immutable: ['code', 'type'],
  });
  configCrud(app, {
    path: '/checklist-items',
    repo: 'checklistItems',
    entity: 'checklistItem',
    permission: 'settings.write',
    schema: ChecklistItemInput,
    idOf: (brandId) => `${brandId}__chk${Date.now().toString(36)}`,
    immutable: ['kind'],
  });

  /** Replace a location's settings. Tax and payroll changes need the owner-only permission. */
  app.put('/settings', { preHandler: guard('settings.write') }, async (req) => {
    const ctx = ctxOf(req);
    const locationId = resolveLocation(ctx, (req.query as { locationId?: string }).locationId);
    const next = validate(Settings, req.body);
    const id = settingsId(ctx.actor.brandId, locationId);
    return app.store.transaction(async (tx) => {
      const current = await tx.settings.get(id);
      if (!current) throw new AppError('NOT_FOUND', 'Location is not configured');
      const sensitiveChanged =
        JSON.stringify(current.settings.tax) !== JSON.stringify(next.tax) ||
        JSON.stringify(current.settings.payroll) !== JSON.stringify(next.payroll);
      if (sensitiveChanged && !can(ctx.actor.role, 'settings.write.sensitive')) {
        throw new AppError('FORBIDDEN', 'Only the owner can change tax and payroll settings');
      }
      const saved = await tx.settings.update(id, {
        settings: next,
        updatedAt: ctx.now.toISOString(),
        updatedBy: ctx.actor.id,
      });
      await audit(tx, ctx, {
        action: 'settings.update',
        entity: 'settings',
        entityId: id,
        locationId,
        before: current.settings,
        after: next,
      });
      return saved.settings;
    });
  });
}

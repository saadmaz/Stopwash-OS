import { IncentiveRuleInput, type IncentiveRule, type IncentiveTier } from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';

export const RulePatch = IncentiveRuleInput.partial().extend({ archived: z.boolean().optional() });

function normalizeTiers(tiers: IncentiveTier[]): IncentiveTier[] {
  const sorted = [...tiers].sort((a, b) => a.target - b.target);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.target === sorted[i - 1]!.target) {
      throw new AppError('VALIDATION_FAILED', `Two tiers share the target ${sorted[i]!.target}`);
    }
  }
  return sorted;
}

export async function listRules(
  repos: Pick<Repositories, 'incentiveRules'>,
  ctx: Ctx,
  includeArchived = false,
) {
  const where = [eq<IncentiveRule>('brandId', ctx.actor.brandId)];
  if (!includeArchived) where.push(eq('archived', false));
  return repos.incentiveRules.find({ where, orderBy: { field: 'name' } });
}

export async function createRule(
  tx: Repositories,
  ctx: Ctx,
  input: z.infer<typeof IncentiveRuleInput>,
) {
  const at = ctx.now.toISOString();
  const rule: IncentiveRule = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    createdAt: at,
    createdBy: ctx.actor.id,
    updatedAt: null,
    updatedBy: null,
    name: input.name,
    weekdayTiers: normalizeTiers(input.weekdayTiers),
    weekendTiers: normalizeTiers(input.weekendTiers),
    archived: false,
  };
  await tx.incentiveRules.insert(rule);
  await audit(tx, ctx, {
    action: 'incentive.create',
    entity: 'incentiveRule',
    entityId: rule.id,
    after: rule,
  });
  return rule;
}

export async function updateRule(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  patch: z.infer<typeof RulePatch>,
) {
  const before = await tx.incentiveRules.get(id);
  if (!before || before.brandId !== ctx.actor.brandId) {
    throw new AppError('NOT_FOUND', 'Rule not found');
  }
  const next: Partial<IncentiveRule> = {
    ...patch,
    updatedAt: ctx.now.toISOString(),
    updatedBy: ctx.actor.id,
  };
  if (patch.weekdayTiers) next.weekdayTiers = normalizeTiers(patch.weekdayTiers);
  if (patch.weekendTiers) next.weekendTiers = normalizeTiers(patch.weekendTiers);
  const after = await tx.incentiveRules.update(id, next);
  await audit(tx, ctx, {
    action: patch.archived ? 'incentive.archive' : 'incentive.update',
    entity: 'incentiveRule',
    entityId: id,
    before,
    after,
  });
  return after;
}

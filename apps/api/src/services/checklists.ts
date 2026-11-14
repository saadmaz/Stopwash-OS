import {
  equipmentAlertMessage,
  stockAlertMessage,
  whatsappAlerts,
  type Alert,
  type Checklist,
  type WhatsappAlert,
} from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { newId } from '../lib/ids';
import { eq, type Repositories } from '../repos';
import { audit } from './audit';
import { getSettings } from './config';

export const ChecklistInput = z.object({
  kind: z.enum(['PRE_SHIFT', 'REQUEST']),
  entries: z
    .array(z.object({ itemId: z.string().min(1), status: z.enum(['OK', 'FAULT']) }))
    .max(50),
  notes: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
});
export type ChecklistInput = z.infer<typeof ChecklistInput>;

export interface ChecklistResult {
  checklist: Checklist;
  alerts: Alert[];
  whatsapp: WhatsappAlert[];
}

/**
 * Records a pre-shift check (or a mid-shift stock request). Every active item must be answered on
 * a pre-shift check. Low stock and faults raise alerts and come back with wa.me links built from
 * the configured numbers (nothing is sent automatically).
 */
export async function submitChecklist(
  tx: Repositories,
  ctx: Ctx,
  locationId: string,
  input: ChecklistInput,
): Promise<ChecklistResult> {
  const brandId = ctx.actor.brandId;
  const items = await tx.checklistItems.find({
    where: [eq('brandId', brandId), eq('active', true)],
    orderBy: { field: 'sort' },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const e of input.entries) {
    if (!byId.has(e.itemId))
      throw new AppError('VALIDATION_FAILED', `Unknown checklist item ${e.itemId}`);
  }
  const answered = new Map(input.entries.map((e) => [e.itemId, e.status]));
  if (input.kind === 'PRE_SHIFT') {
    const missing = items.filter((i) => !answered.has(i.id));
    if (missing.length) {
      throw new AppError('VALIDATION_FAILED', 'Answer every check', {
        missing: missing.map((m) => m.id),
      });
    }
  } else if (![...answered.values()].includes('FAULT')) {
    throw new AppError('VALIDATION_FAILED', 'Mark at least one item as running low to request it');
  }

  const at = ctx.now.toISOString();
  const entry = (kind: 'stock' | 'equipment') =>
    items
      .filter((i) => i.kind === kind && answered.has(i.id))
      .map((i) => ({ itemId: i.id, name: i.name.en, status: answered.get(i.id)! }));
  const location = await tx.locations.get(locationId);
  const checklist: Checklist = {
    id: newId(ctx.now),
    brandId,
    locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    shiftId: input.kind === 'REQUEST' ? (location?.openShiftId ?? null) : null,
    kind: input.kind,
    stock: entry('stock'),
    equipment: entry('equipment'),
    notes: input.notes,
  };
  await tx.checklists.insert(checklist);

  const settings = await getSettings(tx, brandId, locationId);
  const low = checklist.stock.filter((s) => s.status === 'FAULT').map((s) => s.name);
  const faulty = checklist.equipment.filter((s) => s.status === 'FAULT').map((s) => s.name);
  const alerts: Alert[] = [];
  const whatsapp: WhatsappAlert[] = [];
  const raise = async (kind: Alert['kind'], severity: Alert['severity'], message: string) => {
    const alert: Alert = {
      id: newId(ctx.now),
      brandId,
      locationId,
      createdAt: at,
      createdBy: ctx.actor.id,
      kind,
      severity,
      message,
      refType: 'checklist',
      refId: checklist.id,
      acknowledgedBy: [],
    };
    await tx.alerts.insert(alert);
    alerts.push(alert);
  };
  if (low.length) {
    await raise(
      'LOW_STOCK',
      'warning',
      `${input.kind === 'REQUEST' ? 'Stock requested' : 'Running low'}: ${low.join(', ')}`,
    );
    whatsapp.push(
      ...whatsappAlerts(
        'stock',
        settings.notificationNumbers.stock,
        stockAlertMessage(low, at, input.kind, ctx.actor.name),
      ),
    );
  }
  if (faulty.length && input.kind === 'PRE_SHIFT') {
    await raise('EQUIPMENT_FAULT', 'danger', `Faulty: ${faulty.join(', ')}`);
    whatsapp.push(
      ...whatsappAlerts(
        'equipment',
        settings.notificationNumbers.equipment,
        equipmentAlertMessage(faulty, at),
      ),
    );
  }
  await audit(tx, ctx, {
    action: 'checklist.submit',
    entity: 'checklist',
    entityId: checklist.id,
    locationId,
    after: { kind: input.kind, low, faulty },
  });
  return { checklist, alerts, whatsapp };
}

/** Latest pre-shift stock state for the dashboard banner. */
export async function stockStatus(
  repos: Pick<Repositories, 'checklists'>,
  brandId: string,
  locationId: string,
) {
  const [latest] = await repos.checklists.find({
    where: [eq('brandId', brandId), eq('locationId', locationId), eq('kind', 'PRE_SHIFT')],
    orderBy: { field: 'createdAt', dir: 'desc' },
    limit: 1,
  });
  return {
    checkedAt: latest?.createdAt ?? null,
    low: latest?.stock.filter((s) => s.status === 'FAULT').map((s) => s.name) ?? [],
    faulty: latest?.equipment.filter((s) => s.status === 'FAULT').map((s) => s.name) ?? [],
  };
}

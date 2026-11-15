import {
  DateKeyField,
  multiply,
  NonNegativeCents,
  PositiveCents,
  subtract,
  sum,
  type Invoice,
} from '@stopwash/shared';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { assertLocation } from '../lib/guard';
import { newId } from '../lib/ids';
import { eq, type InvoiceSettlement, type Repositories } from '../repos';
import { audit } from './audit';
import { getSettings } from './config';

export const CreateInvoiceInput = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().max(300).nullish(),
  }),
  date: DateKeyField,
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(120),
        qty: z.number().int().min(1).max(9999),
        unitPriceCents: NonNegativeCents,
      }),
    )
    .min(1)
    .max(50),
  discountCents: NonNegativeCents.default(0),
  paid: z.object({ method: z.string().min(1).max(30) }).nullish(),
});

export const SettleInput = z.object({
  amountCents: PositiveCents,
  method: z.string().min(1).max(30),
  note: z.string().trim().max(200).nullish(),
});

export interface InvoiceView extends Invoice {
  paidCents: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOID';
}

async function upsertBillingCustomer(
  tx: Repositories,
  ctx: Ctx,
  name: string,
  address: string | null,
) {
  const nameKey = name.toLowerCase();
  const [existing] = await tx.billingCustomers.find({
    where: [eq('brandId', ctx.actor.brandId), eq('nameKey', nameKey)],
    limit: 1,
  });
  const at = ctx.now.toISOString();
  if (existing) {
    if (address && address !== existing.address) {
      await tx.billingCustomers.update(existing.id, { address, updatedAt: at });
    }
    return existing.id;
  }
  const id = newId(ctx.now);
  await tx.billingCustomers.insert({
    id,
    brandId: ctx.actor.brandId,
    name,
    nameKey,
    address,
    createdAt: at,
    updatedAt: null,
  });
  return id;
}

export async function createInvoice(
  tx: Repositories,
  ctx: Ctx,
  locationId: string,
  input: z.infer<typeof CreateInvoiceInput>,
): Promise<Invoice> {
  const settings = await getSettings(tx, ctx.actor.brandId, locationId);
  const lines = input.lines.map((l) => ({ ...l, totalCents: multiply(l.unitPriceCents, l.qty) }));
  const subtotalCents = sum(lines.map((l) => l.totalCents));
  if (input.discountCents > subtotalCents)
    throw new AppError('VALIDATION_FAILED', 'Discount is larger than the invoice');
  const seq = await tx.counters.next(ctx.actor.brandId, 'invoice', settings.invoice.nextNumberSeed);
  const at = ctx.now.toISOString();
  const invoice: Invoice = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    locationId,
    createdAt: at,
    createdBy: ctx.actor.id,
    number: String(seq),
    billingCustomerId: await upsertBillingCustomer(
      tx,
      ctx,
      input.customer.name,
      input.customer.address ?? null,
    ),
    customerSnapshot: { name: input.customer.name, address: input.customer.address ?? null },
    date: input.date,
    lines,
    subtotalCents,
    discountCents: input.discountCents,
    taxCents: 0,
    totalCents: subtract(subtotalCents, input.discountCents),
    voidsId: null,
    voidReason: null,
  };
  await tx.invoices.insert(invoice);
  if (input.paid && invoice.totalCents > 0) {
    await settle(tx, ctx, invoice.id, {
      amountCents: invoice.totalCents,
      method: input.paid.method,
      note: null,
    });
  }
  await audit(tx, ctx, {
    action: 'invoice.create',
    entity: 'invoice',
    entityId: invoice.id,
    locationId,
    after: invoice,
  });
  return invoice;
}

export async function settle(
  tx: Repositories,
  ctx: Ctx,
  invoiceId: string,
  input: z.infer<typeof SettleInput>,
) {
  const invoice = await tx.invoices.get(invoiceId);
  if (!invoice || invoice.brandId !== ctx.actor.brandId || invoice.voidsId)
    throw new AppError('NOT_FOUND', 'Invoice not found');
  assertLocation(ctx, invoice.locationId);
  const settlement: InvoiceSettlement = {
    id: newId(ctx.now),
    brandId: ctx.actor.brandId,
    invoiceId,
    amountCents: input.amountCents,
    method: input.method,
    note: input.note ?? null,
    reversesId: null,
    createdAt: ctx.now.toISOString(),
    createdBy: ctx.actor.id,
  };
  await tx.invoiceSettlements.insert(settlement);
  await audit(tx, ctx, {
    action: 'invoice.settle',
    entity: 'invoice',
    entityId: invoiceId,
    after: settlement,
  });
  return settlement;
}

/** Voids by appending a void record that points at the original (nothing is edited or deleted). */
export async function voidInvoice(
  tx: Repositories,
  ctx: Ctx,
  id: string,
  reason: string,
): Promise<Invoice> {
  const original = await tx.invoices.get(id);
  if (!original || original.brandId !== ctx.actor.brandId || original.voidsId)
    throw new AppError('NOT_FOUND', 'Invoice not found');
  assertLocation(ctx, original.locationId);
  const already = await tx.invoices.find({
    where: [eq('brandId', ctx.actor.brandId), eq('voidsId', id)],
    limit: 1,
  });
  if (already.length) throw new AppError('ALREADY_REVERSED', 'Already void');
  const record: Invoice = {
    ...original,
    id: newId(ctx.now),
    createdAt: ctx.now.toISOString(),
    createdBy: ctx.actor.id,
    voidsId: id,
    voidReason: reason,
  };
  await tx.invoices.insert(record);
  await audit(tx, ctx, { action: 'invoice.void', entity: 'invoice', entityId: id, reason });
  return record;
}

export async function listInvoices(repos: Repositories, ctx: Ctx): Promise<InvoiceView[]> {
  const brandId = ctx.actor.brandId;
  const [all, settlements] = await Promise.all([
    repos.invoices.find({
      where: [eq('brandId', brandId)],
      orderBy: { field: 'createdAt', dir: 'desc' },
      limit: 300,
    }),
    repos.invoiceSettlements.find({ where: [eq('brandId', brandId)] }),
  ]);
  const voided = new Set(all.map((i) => i.voidsId).filter(Boolean));
  const visible = (loc: string) =>
    ctx.actor.role === 'owner' || ctx.actor.locationIds.includes(loc);
  return all
    .filter((i) => !i.voidsId && visible(i.locationId))
    .map((i) => {
      const paidCents = sum(
        settlements.filter((s) => s.invoiceId === i.id).map((s) => s.amountCents),
      );
      const status = voided.has(i.id)
        ? 'VOID'
        : paidCents >= i.totalCents
          ? 'PAID'
          : paidCents > 0
            ? 'PARTIAL'
            : 'UNPAID';
      return { ...i, paidCents, status };
    });
}

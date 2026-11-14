import { z } from 'zod';
import { CashMovementType, CatalogKind } from './catalog';
import {
  CentsField,
  DateKeyField,
  Id,
  Mutable,
  NonNegativeCents,
  OptionalText,
  PositiveCents,
  RequiredText,
  Scoped,
  Timestamp,
} from './common';

/* ── Orders ─────────────────────────────────────────── */

export const ORDER_STATUSES = ['QUEUED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED'] as const;
export const OrderStatus = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatus>;

/** A priced line, snapshotted at order time so later price changes never alter history. */
export const OrderLine = z.object({
  itemId: Id,
  kind: CatalogKind,
  code: z.string(),
  name: z.string(),
  unitPriceCents: NonNegativeCents,
  qty: z.number().int().min(1).max(99),
  totalCents: NonNegativeCents,
});
export type OrderLine = z.infer<typeof OrderLine>;

export const StatusChange = z.object({ status: OrderStatus, at: Timestamp, by: Id });

export const Order = Scoped.extend({
  number: z.string().nullable(), // receipt number, assigned at checkout
  ticket: z.number().int().positive(), // short daily number shown on the board, e.g. #12
  plateKey: z.string(),
  plateDisplay: z.string(),
  customerId: Id.nullable(),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  returning: z.boolean(),
  lines: z.array(OrderLine).min(1),
  subtotalCents: NonNegativeCents,
  discountCents: NonNegativeCents,
  discountReason: z.string().nullable(),
  loyaltyDiscountCents: NonNegativeCents,
  taxCents: NonNegativeCents,
  totalCents: NonNegativeCents,
  paidCents: CentsField,
  status: OrderStatus,
  statusHistory: z.array(StatusChange),
  assignedEmployeeId: Id.nullable(),
  shiftId: Id.nullable(),
  businessDate: DateKeyField,
  completedAt: Timestamp.nullable(),
  cancelReason: z.string().nullable(),
  backdated: z.boolean(),
  source: z.enum(['counter', 'floor', 'import']),
}).extend(Mutable.shape);
export type Order = z.infer<typeof Order>;

/** Plate plus at least one vehicle class or product (old rule: add-ons alone are not enough). */
export const CreateOrderInput = z.object({
  plate: RequiredText(24),
  customerName: OptionalText(80),
  customerPhone: OptionalText(20),
  lines: z
    .array(z.object({ itemId: Id, qty: z.number().int().min(1).max(99) }))
    .min(1)
    .max(30),
  assignedEmployeeId: Id.nullish().transform((v) => v ?? null),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

/* ── Payments (append-only) ─────────────────────────── */

export const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'OTHER'] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const Payment = Scoped.extend({
  orderId: Id,
  shiftId: Id,
  businessDate: DateKeyField,
  method: PaymentMethod,
  /** Negative for refunds and reversals. */
  amountCents: CentsField.refine((v) => v !== 0, 'Amount cannot be zero'),
  reversesId: Id.nullable(),
  reason: z.string().nullable(),
});
export type Payment = z.infer<typeof Payment>;

export const Tender = z.object({ method: PaymentMethod, amountCents: PositiveCents });
export type Tender = z.infer<typeof Tender>;

export const CheckoutInput = z.object({
  /** Empty only when the total is zero (fully discounted). */
  tenders: z.array(Tender).max(4),
  discountCents: NonNegativeCents.default(0),
  discountReason: OptionalText(200),
  /** Manager override for discounts above the configured percentage. */
  override: z.object({ employeeId: Id, pin: z.string().regex(/^\d{4,6}$/) }).nullish(),
});
export type CheckoutInput = z.infer<typeof CheckoutInput>;

/* ── Shifts ─────────────────────────────────────────── */

export const DenominationCountField = z.object({
  notes: z.record(z.string().regex(/^\d+$/), z.number().int().min(0).max(9999)),
  coinsCents: NonNegativeCents,
});
export type DenominationCountValue = z.infer<typeof DenominationCountField>;

export const ShiftStatus = z.enum(['OPEN', 'CLOSED', 'APPROVED', 'QUERIED']);
export type ShiftStatus = z.infer<typeof ShiftStatus>;

export const Shift = Scoped.extend({
  status: ShiftStatus,
  supervisorEmployeeId: Id,
  supervisorName: z.string(),
  openedAt: Timestamp,
  businessDate: DateKeyField,
  checklistId: Id.nullable(),
  openingCount: DenominationCountField,
  openingCents: NonNegativeCents,
  carryoverNotes: z.string().nullable(),
  closeId: Id.nullable(),
  closedAt: Timestamp.nullable(),
  approvalId: Id.nullable(),
  backdated: z.boolean(),
}).extend(Mutable.shape);
export type Shift = z.infer<typeof Shift>;

export const ChecklistEntry = z.object({
  itemId: Id,
  name: z.string(),
  status: z.enum(['OK', 'FAULT']),
});

export const Checklist = Scoped.extend({
  shiftId: Id.nullable(),
  kind: z.enum(['PRE_SHIFT', 'REQUEST']),
  stock: z.array(ChecklistEntry),
  equipment: z.array(ChecklistEntry),
  notes: z.string().nullable(),
});
export type Checklist = z.infer<typeof Checklist>;

/* ── Cash movements (append-only) ───────────────────── */

export const CashMovement = Scoped.extend({
  shiftId: Id,
  businessDate: DateKeyField,
  type: CashMovementType,
  categoryId: Id,
  categoryCode: z.string(),
  categoryName: z.string(),
  /** Negative when reversing an earlier entry. */
  amountCents: CentsField.refine((v) => v !== 0),
  paidTo: z.string(),
  description: z.string().nullable(),
  approvedByEmployeeId: Id.nullable(),
  reversesId: Id.nullable(),
  reason: z.string().nullable(),
  backdated: z.boolean(),
});
export type CashMovement = z.infer<typeof CashMovement>;

/* ── Shift close, approval (append-only) ────────────── */

export const ShiftClose = Scoped.extend({
  shiftId: Id,
  kind: z.enum(['CLOSE', 'ADJUSTMENT']),
  adjustsId: Id.nullable(),
  openingCents: NonNegativeCents,
  cashSalesCents: CentsField,
  cardSalesCents: CentsField,
  otherSalesCents: CentsField,
  expensesCents: CentsField,
  depositsCents: CentsField,
  expectedCents: CentsField,
  countedCents: NonNegativeCents,
  varianceCents: CentsField,
  closingCount: DenominationCountField,
  vehicleCount: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  overrideByEmployeeId: Id.nullable(),
  handoverEmployeeId: Id.nullable(),
  handoverName: z.string().nullable(),
  reason: z.string().nullable(),
});
export type ShiftClose = z.infer<typeof ShiftClose>;

export const ShiftApproval = Scoped.extend({
  shiftId: Id,
  decision: z.enum(['APPROVED', 'QUERIED']),
  note: z.string().nullable(),
});
export type ShiftApproval = z.infer<typeof ShiftApproval>;

export const Alert = Scoped.extend({
  kind: z.enum(['LOW_STOCK', 'EQUIPMENT_FAULT', 'VARIANCE', 'LARGE_DISCOUNT']),
  severity: z.enum(['info', 'warning', 'danger']),
  message: z.string(),
  refType: z.string(),
  refId: Id,
  acknowledgedBy: z.array(Id),
});
export type Alert = z.infer<typeof Alert>;

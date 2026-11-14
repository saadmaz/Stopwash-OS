import { z } from 'zod';
import { ROLES } from '../rbac';
import {
  BaseRecord,
  CentsField,
  DateKeyField,
  Id,
  LocationId,
  Mutable,
  NonNegativeCents,
  OptionalText,
  PeriodKeyField,
  PositiveCents,
  RequiredText,
  Scoped,
  Timestamp,
} from './common';

/* ── Users & employees ─────────────────────────────── */

export const RoleField = z.enum(ROLES);

export const User = BaseRecord.extend({
  email: z.email().nullable(),
  displayName: RequiredText(80),
  role: RoleField,
  locationIds: z.array(LocationId),
  employeeId: Id.nullable(),
  active: z.boolean(),
}).extend(Mutable.shape);
export type User = z.infer<typeof User>;

export const JOB_TITLES = ['Washer', 'Supervisor', 'Trainee', 'Manager', 'Cashier', 'Accounts'];

export const EmployeeInput = z.object({
  code: z.string().regex(/^[A-Z]{2}\d{3,5}$/, 'Code like SW001'),
  name: RequiredText(80),
  phone: RequiredText(20),
  jobTitle: RequiredText(40),
  /** System role when the employee signs in; null = no POS access. */
  systemRole: RoleField.nullable(),
  locationIds: z.array(LocationId).min(1),
  baseSalaryCents: NonNegativeCents,
  recurringDeductionCents: NonNegativeCents,
  recurringAdditionCents: NonNegativeCents,
  incentiveRuleId: Id.nullable(),
  canOpenShift: z.boolean(),
});
export type EmployeeInput = z.infer<typeof EmployeeInput>;

export const Employee = BaseRecord.extend(EmployeeInput.shape)
  .extend({
    /** Periods (YYYY-MM) where recurring additions/deductions are skipped. */
    exemptMonths: z.array(PeriodKeyField),
    active: z.boolean(),
    hasPin: z.boolean(),
  })
  .extend(Mutable.shape);
export type Employee = z.infer<typeof Employee>;

export const Pin = z.string().regex(/^\d{4,6}$/, 'PIN is 4–6 digits');

/* ── Attendance & leave ────────────────────────────── */

export const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'LEAVE'] as const;
export const AttendanceStatus = z.enum(ATTENDANCE_STATUSES);
export type AttendanceStatus = z.infer<typeof AttendanceStatus>;

export const Attendance = Scoped.extend({
  employeeId: Id,
  date: DateKeyField,
  status: AttendanceStatus,
  clockInAt: Timestamp.nullable(),
  clockOutAt: Timestamp.nullable(),
  note: z.string().nullable(),
}).extend(Mutable.shape);
export type Attendance = z.infer<typeof Attendance>;

export const LeaveStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export const LeaveInput = z
  .object({
    employeeId: Id,
    startDate: DateKeyField,
    endDate: DateKeyField,
    reason: RequiredText(500),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });
export type LeaveInput = z.infer<typeof LeaveInput>;

export const Leave = BaseRecord.extend({
  employeeId: Id,
  employeeName: z.string(),
  startDate: DateKeyField,
  endDate: DateKeyField,
  days: z.number().int().positive(),
  reason: z.string(),
  status: LeaveStatus,
  processedBy: Id.nullable(),
  processedAt: Timestamp.nullable(),
});
export type Leave = z.infer<typeof Leave>;

/* ── Incentives & payroll ──────────────────────────── */

export const IncentiveTier = z.object({
  target: z.number().int().positive(),
  bonusCents: PositiveCents,
});
export type IncentiveTier = z.infer<typeof IncentiveTier>;

export const IncentiveRuleInput = z.object({
  name: RequiredText(60),
  weekdayTiers: z.array(IncentiveTier).max(10),
  weekendTiers: z.array(IncentiveTier).max(10),
});
export const IncentiveRule = BaseRecord.extend(IncentiveRuleInput.shape)
  .extend({ archived: z.boolean() })
  .extend(Mutable.shape);
export type IncentiveRule = z.infer<typeof IncentiveRule>;

export const DEDUCTION_CATEGORIES = [
  'FOOD',
  'ACCOMMODATION',
  'ADVANCE',
  'PENALTY',
  'OTHER',
] as const;

/** Append-only. Negative amount with reversesId undoes an earlier entry. */
export const PayrollAdjustment = BaseRecord.extend({
  employeeId: Id,
  period: PeriodKeyField,
  date: DateKeyField,
  kind: z.enum(['DEDUCTION', 'BONUS']),
  category: z.string().max(30),
  amountCents: CentsField.refine((v) => v !== 0),
  reason: z.string(),
  reversesId: Id.nullable(),
});
export type PayrollAdjustment = z.infer<typeof PayrollAdjustment>;

export const IncentiveDay = z.object({
  date: DateKeyField,
  count: z.number().int().nonnegative(),
  tierTarget: z.number().int().positive(),
  bonusCents: NonNegativeCents,
  multiplier: z.number().min(0).max(1),
});

export const PayslipLine = z.object({
  employeeId: Id,
  name: z.string(),
  code: z.string(),
  jobTitle: z.string(),
  baseCents: NonNegativeCents,
  incentiveCents: NonNegativeCents,
  incentiveBreakdown: z.array(IncentiveDay),
  bonusAdjCents: CentsField,
  recurringAdditionCents: NonNegativeCents,
  recurringDeductionCents: NonNegativeCents,
  oneOffDeductionCents: CentsField,
  deductionBreakdown: z.array(
    z.object({ date: z.string(), reason: z.string(), amountCents: CentsField }),
  ),
  epfEmployeeCents: NonNegativeCents,
  epfEmployerCents: NonNegativeCents,
  etfEmployerCents: NonNegativeCents,
  netCents: CentsField,
});
export type PayslipLine = z.infer<typeof PayslipLine>;

export const PayrollRun = BaseRecord.extend({
  period: PeriodKeyField,
  kind: z.enum(['REGULAR', 'SUPPLEMENTARY']),
  supersedesId: Id.nullable(),
  lines: z.array(PayslipLine),
  totals: z.object({
    grossCents: CentsField,
    deductionsCents: CentsField,
    netCents: CentsField,
    employerCostCents: CentsField,
  }),
});
export type PayrollRun = z.infer<typeof PayrollRun>;

/* ── B2B invoices (append-only) ────────────────────── */

export const InvoiceLine = z.object({
  description: RequiredText(120),
  qty: z.number().int().positive(),
  unitPriceCents: NonNegativeCents,
  totalCents: NonNegativeCents,
});

export const Invoice = Scoped.extend({
  number: z.string(),
  billingCustomerId: Id.nullable(),
  customerSnapshot: z.object({ name: z.string(), address: z.string().nullable() }),
  date: DateKeyField,
  lines: z.array(InvoiceLine).min(1),
  subtotalCents: NonNegativeCents,
  discountCents: NonNegativeCents,
  taxCents: NonNegativeCents,
  totalCents: NonNegativeCents,
  voidsId: Id.nullable(),
  voidReason: OptionalText(200),
});
export type Invoice = z.infer<typeof Invoice>;

/* ── Audit log (append-only) ───────────────────────── */

export const AuditEntry = z.object({
  id: Id,
  brandId: z.string(),
  locationId: z.string().nullable(),
  at: Timestamp,
  actorId: Id,
  actorName: z.string(),
  actorRole: z.string(),
  action: z.string().regex(/^[a-z]+(\.[a-zA-Z]+)+$/, 'e.g. order.create'),
  entity: z.string(),
  entityId: Id,
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  reason: z.string().nullable(),
  requestId: z.string().nullable(),
  deviceId: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

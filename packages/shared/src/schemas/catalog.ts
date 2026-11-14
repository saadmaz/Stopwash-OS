import { z } from 'zod';
import {
  BaseRecord,
  CentsField,
  Id,
  LocalizedText,
  LocationId,
  Mutable,
  NonNegativeCents,
  OptionalText,
  RequiredText,
  Timestamp,
} from './common';

/* ── Catalog: vehicle classes, add-ons, products ─────── */

export const CatalogKind = z.enum(['vehicleClass', 'addon', 'product']);
export type CatalogKind = z.infer<typeof CatalogKind>;

export const CatalogItemInput = z.object({
  kind: CatalogKind,
  code: z.string().regex(/^[A-Z0-9_]{2,32}$/, 'Use CAPITALS, digits and _'),
  name: LocalizedText,
  description: OptionalText(200),
  priceCents: NonNegativeCents,
  /** Max quantity per order. Add-ons default to 1 (on/off). */
  maxQty: z.number().int().min(1).max(99),
  locationIds: z.array(LocationId).nullable(), // null = all locations
  icon: z.string().max(40).nullable(),
  sort: z.number().int(),
  active: z.boolean(),
});
export type CatalogItemInput = z.infer<typeof CatalogItemInput>;

export const CatalogItem = BaseRecord.extend(CatalogItemInput.shape).extend(Mutable.shape);
export type CatalogItem = z.infer<typeof CatalogItem>;

/* ── Checklist items, cash categories ───────────────── */

export const ChecklistItemKind = z.enum(['stock', 'equipment']);
export const ChecklistItemInput = z.object({
  kind: ChecklistItemKind,
  name: LocalizedText,
  okLabel: LocalizedText,
  faultLabel: LocalizedText,
  sort: z.number().int(),
  active: z.boolean(),
});
export const ChecklistItem = BaseRecord.extend(ChecklistItemInput.shape).extend(Mutable.shape);
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const CashMovementType = z.enum(['EXPENSE', 'DEPOSIT']);
export type CashMovementType = z.infer<typeof CashMovementType>;

export const CashCategoryInput = z.object({
  type: CashMovementType,
  code: z.string().regex(/^[ED]\d{3}$/, 'E001… for expenses, D001… for deposits'),
  name: LocalizedText,
  sort: z.number().int(),
  active: z.boolean(),
});
export const CashCategory = BaseRecord.extend(CashCategoryInput.shape).extend(Mutable.shape);
export type CashCategory = z.infer<typeof CashCategory>;

/* ── Location settings ─────────────────────────────── */

const Phone = z.string().regex(/^\+?\d{9,15}$/, 'Phone in international format, e.g. +94771234567');

export const Settings = z.object({
  dailyVehicleTarget: z.number().int().min(1).max(1000),
  variance: z
    .object({
      /** |variance| above this needs a written explanation (old app: LKR 500). */
      explainAboveCents: NonNegativeCents,
      /** |variance| above this needs a manager PIN override (old app: LKR 2,000). */
      overrideAboveCents: NonNegativeCents,
    })
    .refine((v) => v.overrideAboveCents >= v.explainAboveCents, {
      message: 'Override threshold must be at least the explanation threshold',
    }),
  cashOut: z.object({ approvalAboveCents: NonNegativeCents }),
  discount: z.object({ overrideAbovePct: z.number().min(0).max(100) }),
  /** Note denominations in cents, largest first. Coins are counted as a total value. */
  denominations: z.array(CentsField.positive()).min(1).max(12),
  notificationNumbers: z.object({
    stock: z.array(Phone).max(5),
    equipment: z.array(Phone).max(5),
    variance: z.array(Phone).max(5),
  }),
  tax: z.object({
    enabled: z.boolean(),
    name: RequiredText(20),
    ratePct: z.number().min(0).max(50),
    inclusive: z.boolean(),
    registrationNo: OptionalText(40),
  }),
  receipt: z.object({
    prefix: z.string().regex(/^[A-Z]{2,5}$/),
    footer: OptionalText(200),
  }),
  weekendDays: z.array(z.number().int().min(0).max(6)).max(7),
  loyalty: z.object({
    enabled: z.boolean(),
    everyNth: z.number().int().min(2).max(50),
    rewardPct: z.number().min(1).max(100),
  }),
  payroll: z.object({
    attendanceMultiplier: z.object({
      enabled: z.boolean(),
      PRESENT: z.number().min(0).max(1),
      LATE: z.number().min(0).max(1),
      HALF_DAY: z.number().min(0).max(1),
      ABSENT: z.number().min(0).max(1),
      LEAVE: z.number().min(0).max(1),
    }),
    statutory: z.object({
      enabled: z.boolean(),
      epfEmployeePct: z.number().min(0).max(30),
      epfEmployerPct: z.number().min(0).max(30),
      etfEmployerPct: z.number().min(0).max(30),
    }),
  }),
  business: z.object({
    name: RequiredText(80),
    address: OptionalText(200),
    phone: OptionalText(30),
    email: OptionalText(80),
    taxId: OptionalText(40),
    bankDetails: OptionalText(300),
  }),
  invoice: z.object({ nextNumberSeed: z.number().int().positive() }),
});
export type Settings = z.infer<typeof Settings>;

export const SettingsRecord = z.object({
  id: Id,
  brandId: z.string(),
  locationId: LocationId,
  settings: Settings,
  updatedAt: Timestamp,
  updatedBy: Id,
});
export type SettingsRecord = z.infer<typeof SettingsRecord>;

/** Defaults reproduce SWOMS 2.5 behaviour (see PARITY.md). */
export const DEFAULT_SETTINGS: Settings = {
  dailyVehicleTarget: 15,
  variance: { explainAboveCents: 50_000, overrideAboveCents: 200_000 },
  cashOut: { approvalAboveCents: 500_000 },
  discount: { overrideAbovePct: 20 },
  denominations: [500_000, 200_000, 100_000, 50_000, 10_000, 5_000, 2_000],
  notificationNumbers: { stock: [], equipment: [], variance: [] },
  tax: { enabled: false, name: 'VAT', ratePct: 18, inclusive: true, registrationNo: null },
  receipt: { prefix: 'KTB', footer: 'Thank you for choosing STOPWASH' },
  weekendDays: [0, 6],
  loyalty: { enabled: false, everyNth: 6, rewardPct: 50 },
  payroll: {
    attendanceMultiplier: {
      enabled: false,
      PRESENT: 1,
      LATE: 1,
      HALF_DAY: 0.5,
      ABSENT: 0,
      LEAVE: 0,
    },
    statutory: { enabled: false, epfEmployeePct: 8, epfEmployerPct: 12, etfEmployerPct: 3 },
  },
  business: {
    name: 'STOPWASH (PVT) LTD',
    address: 'Katubedda, Moratuwa, Sri Lanka',
    phone: null,
    email: 'hello@stopwash.lk',
    taxId: null,
    bankDetails: null,
  },
  invoice: { nextNumberSeed: 55_100 },
};

/* ── Customers & vehicles ──────────────────────────── */

export const Customer = BaseRecord.extend({
  name: z.string().max(80).nullable(),
  phone: z.string().max(20).nullable(),
  plateKeys: z.array(z.string()).max(50),
  firstSeenAt: Timestamp,
  lastSeenAt: Timestamp,
  visitCount: z.number().int().nonnegative(),
  totalSpentCents: NonNegativeCents,
}).extend(Mutable.shape);
export type Customer = z.infer<typeof Customer>;

export const Vehicle = BaseRecord.extend({
  plateKey: z.string().min(1).max(20),
  plateDisplay: z.string().min(1).max(24),
  vehicleClassCode: z.string().nullable(),
  customerId: Id.nullable(),
  visitCount: z.number().int().nonnegative(),
  completedVisits: z.number().int().nonnegative(),
  totalSpentCents: NonNegativeCents,
  firstSeenAt: Timestamp,
  lastSeenAt: Timestamp,
  lastServiceSummary: z.string().max(200).nullable(),
  /** Completed visits counted towards the next loyalty reward. */
  loyaltyProgress: z.number().int().nonnegative(),
}).extend(Mutable.shape);
export type Vehicle = z.infer<typeof Vehicle>;

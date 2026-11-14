import type {
  Alert,
  Attendance,
  AuditEntry,
  CashCategory,
  CashMovement,
  CatalogItem,
  Checklist,
  ChecklistItem,
  Customer,
  Employee,
  IncentiveRule,
  Invoice,
  Leave,
  Order,
  Payment,
  PayrollAdjustment,
  PayrollRun,
  SettingsRecord,
  Shift,
  ShiftApproval,
  ShiftClose,
  User,
  Vehicle,
} from '@stopwash/shared';

/* ── Query model (a subset Firestore can serve with composite indexes) ── */

export type Op = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
export interface Cond<T> {
  field: keyof T & string;
  op: Op;
  value: unknown;
}
export interface FindOptions<T> {
  where: Cond<T>[];
  orderBy?: { field: keyof T & string; dir?: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

export const eq = <T>(field: keyof T & string, value: unknown): Cond<T> => ({
  field,
  op: '==',
  value,
});

export interface Identified {
  id: string;
}

/** Read access shared by every collection. Every query must filter on brandId. */
export interface ReadRepo<T extends Identified> {
  get(id: string): Promise<T | null>;
  find(opts: FindOptions<T>): Promise<T[]>;
  count(opts: FindOptions<T>): Promise<number>;
}

/** Financial records: insert only. Corrections are new, reversing records. */
export interface AppendOnlyRepo<T extends Identified> extends ReadRepo<T> {
  insert(doc: T): Promise<T>;
}

/** Operational state and configuration: insert, update, upsert (never delete). */
export interface MutableRepo<T extends Identified> extends AppendOnlyRepo<T> {
  update(id: string, patch: Partial<T>): Promise<T>;
  upsert(doc: T): Promise<T>;
}

/* ── Records that live only on the server ── */

export interface EmployeeSecret extends Identified {
  brandId: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: string | null;
  pinUpdatedAt: string;
}

export interface Device extends Identified {
  brandId: string;
  locationId: string;
  name: string;
  secretHash: string;
  kind: 'counter' | 'floor' | 'board' | 'display';
  active: boolean;
  registeredBy: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface Location extends Identified {
  brandId: string;
  code: string;
  name: string;
  timezone: string;
  active: boolean;
  openShiftId: string | null;
}

export interface IdempotencyRecord extends Identified {
  brandId: string;
  actorId: string;
  route: string;
  requestHash: string;
  statusCode: number;
  response: unknown;
  createdAt: string;
  expiresAt: string;
}

export interface Counter extends Identified {
  brandId: string;
  value: number;
}

/* ── Named repositories ── */

export type LocationRepo = MutableRepo<Location>;
export type SettingsRepo = MutableRepo<SettingsRecord>;
export type CatalogRepo = MutableRepo<CatalogItem>;
export type ChecklistItemRepo = MutableRepo<ChecklistItem>;
export type CashCategoryRepo = MutableRepo<CashCategory>;
export type CustomerRepo = MutableRepo<Customer>;
export type VehicleRepo = MutableRepo<Vehicle>;
export type OrderRepo = MutableRepo<Order>;
export type PaymentRepo = AppendOnlyRepo<Payment>;
export type ShiftRepo = MutableRepo<Shift>;
export type ChecklistRepo = AppendOnlyRepo<Checklist>;
export type CashMovementRepo = AppendOnlyRepo<CashMovement>;
export type ShiftCloseRepo = AppendOnlyRepo<ShiftClose>;
export type ShiftApprovalRepo = AppendOnlyRepo<ShiftApproval>;
export type AlertRepo = MutableRepo<Alert>;
export type UserRepo = MutableRepo<User>;
export type EmployeeRepo = MutableRepo<Employee>;
export type EmployeeSecretRepo = MutableRepo<EmployeeSecret>;
export type DeviceRepo = MutableRepo<Device>;
export type AttendanceRepo = MutableRepo<Attendance>;
export type LeaveRepo = MutableRepo<Leave>;
export type IncentiveRuleRepo = MutableRepo<IncentiveRule>;
export type PayrollAdjustmentRepo = AppendOnlyRepo<PayrollAdjustment>;
export type PayrollRunRepo = AppendOnlyRepo<PayrollRun>;
export type InvoiceRepo = AppendOnlyRepo<Invoice>;
export type AuditRepo = AppendOnlyRepo<AuditEntry>;
export type IdempotencyRepo = MutableRepo<IdempotencyRecord>;

export interface CounterRepo {
  /** Atomically increments and returns the new value (starting from `start`). */
  next(brandId: string, key: string, start?: number): Promise<number>;
}

export interface Repositories {
  locations: LocationRepo;
  settings: SettingsRepo;
  catalog: CatalogRepo;
  checklistItems: ChecklistItemRepo;
  cashCategories: CashCategoryRepo;
  customers: CustomerRepo;
  vehicles: VehicleRepo;
  orders: OrderRepo;
  payments: PaymentRepo;
  shifts: ShiftRepo;
  checklists: ChecklistRepo;
  cashMovements: CashMovementRepo;
  shiftCloses: ShiftCloseRepo;
  shiftApprovals: ShiftApprovalRepo;
  alerts: AlertRepo;
  users: UserRepo;
  employees: EmployeeRepo;
  employeeSecrets: EmployeeSecretRepo;
  devices: DeviceRepo;
  attendance: AttendanceRepo;
  leaves: LeaveRepo;
  incentiveRules: IncentiveRuleRepo;
  payrollAdjustments: PayrollAdjustmentRepo;
  payrollRuns: PayrollRunRepo;
  invoices: InvoiceRepo;
  audit: AuditRepo;
  idempotency: IdempotencyRepo;
  counters: CounterRepo;
}

/** Storage backend. `transaction` runs `fn` atomically: all writes commit or none do. */
export interface DataStore extends Repositories {
  readonly backend: 'memory' | 'firestore';
  transaction<R>(fn: (tx: Repositories) => Promise<R>): Promise<R>;
}

export const APPEND_ONLY: ReadonlySet<keyof Repositories> = new Set([
  'payments',
  'checklists',
  'cashMovements',
  'shiftCloses',
  'shiftApprovals',
  'payrollAdjustments',
  'payrollRuns',
  'invoices',
  'audit',
]);

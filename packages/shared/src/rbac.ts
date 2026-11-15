/**
 * Role-based access control. Single source of truth for the API, the web app
 * and (mirrored by hand, and checked by tests) firestore.rules.
 */

export const ROLES = ['owner', 'manager', 'cashier', 'accounts'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // orders & POS
  'order.read',
  'order.create',
  'order.update', // edit lines/customer before payment
  'order.status', // move through QUEUED → IN_PROGRESS → READY
  'order.checkout',
  'order.cancel',
  'order.refund',
  'order.backdate',
  'order.discount.override',
  'customer.read',
  // shifts & cash
  'shift.read',
  'shift.open',
  'shift.close',
  'shift.close.override',
  'shift.backdate',
  'shift.adjust',
  'shift.approve',
  'checklist.submit',
  'cash.read',
  'cash.create',
  'cash.approve',
  'cash.reverse',
  // HR
  'employee.read',
  'employee.write',
  'employee.pin.reset',
  'attendance.read',
  'attendance.write',
  'leave.request',
  'leave.read.all',
  'leave.approve',
  'incentive.write',
  'payroll.read',
  'payroll.adjust',
  'payroll.finalize',
  // reporting
  'report.read',
  'report.export',
  'analytics.read',
  'audit.read',
  'alert.read',
  // invoices
  'invoice.read',
  'invoice.write',
  // admin
  'settings.read',
  'settings.write',
  'settings.write.sensitive', // tax, payroll statutory
  'catalog.write',
  'user.manage',
  'device.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const CASHIER: Permission[] = [
  'order.read',
  'order.create',
  'order.update',
  'order.status',
  'order.checkout',
  'customer.read',
  'shift.read',
  'shift.open',
  'shift.close',
  'checklist.submit',
  'cash.read',
  'cash.create',
  'leave.request',
  'settings.read',
];

const ACCOUNTS: Permission[] = [
  'order.read',
  'customer.read',
  'shift.read',
  'shift.approve',
  'cash.read',
  'employee.read',
  'attendance.read',
  'payroll.read',
  'report.read',
  'report.export',
  'analytics.read',
  'audit.read',
  'alert.read',
  'invoice.read',
  'invoice.write',
  'settings.read',
  'leave.request',
];

const MANAGER: Permission[] = PERMISSIONS.filter(
  (p) => !['settings.write.sensitive', 'user.manage', 'shift.approve'].includes(p),
) as Permission[];

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  owner: new Set(PERMISSIONS),
  manager: new Set([...MANAGER, 'user.manage']),
  cashier: new Set(CASHIER),
  accounts: new Set(ACCOUNTS),
};

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsOf(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/** Roles a given role may assign to other users. */
export function assignableRoles(role: Role): Role[] {
  if (role === 'owner') return [...ROLES];
  if (role === 'manager') return ['cashier', 'accounts'];
  return [];
}

/** Custom claims carried in Firebase ID tokens. */
export interface StopwashClaims {
  role: Role;
  brandId: string;
  locationIds: string[];
  employeeId?: string | null;
  deviceId?: string | null;
}

export function parseClaims(token: Record<string, unknown>): StopwashClaims | null {
  const { role, brandId, locationIds, employeeId, deviceId } = token as Record<string, unknown>;
  if (!isRole(role) || typeof brandId !== 'string' || !Array.isArray(locationIds)) return null;
  return {
    role,
    brandId,
    locationIds: locationIds.filter((l): l is string => typeof l === 'string'),
    employeeId: typeof employeeId === 'string' ? employeeId : null,
    deviceId: typeof deviceId === 'string' ? deviceId : null,
  };
}

export function canAccessLocation(claims: StopwashClaims, locationId: string): boolean {
  return claims.role === 'owner' || claims.locationIds.includes(locationId);
}

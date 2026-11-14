import type { Employee, Role } from '@stopwash/shared';
import { buildApp } from '../src/app';
import { loadEnv } from '../src/env';
import { createMemoryStore, type MemoryStore } from '../src/repos';
import { ensureDefaults } from '../src/services/defaults';
import { hashSecret, setPin } from '../src/services/pin';
import { DevJwtIssuer } from '../src/services/tokens';

export const BRAND = 'stopwash';
export const LOCATION = 'katubedda';
export const DEVICE = { deviceId: 'dev-counter', deviceSecret: 'counter-secret-0123456789' };
export const T0 = '2026-11-15T04:00:00.000Z';

export function employee(id: string, role: Role | null, extra: Partial<Employee> = {}): Employee {
  return {
    id,
    brandId: BRAND,
    createdAt: T0,
    createdBy: 'seed',
    updatedAt: null,
    updatedBy: null,
    code: `SW${id.replace(/\D/g, '').padStart(3, '0')}`,
    name: `Staff ${id}`,
    phone: '+94771234567',
    jobTitle: role === 'manager' ? 'Manager' : 'Washer',
    systemRole: role,
    locationIds: [LOCATION],
    baseSalaryCents: 4_500_000,
    recurringDeductionCents: 0,
    recurringAdditionCents: 0,
    incentiveRuleId: null,
    canOpenShift: role === 'manager',
    exemptMonths: [],
    active: true,
    hasPin: true,
    ...extra,
  };
}

/** Location, a counter device, and staff with PINs (cashier e1 = 4826, manager e2 = 7391). */
export async function seedBasics(store: MemoryStore): Promise<void> {
  await store.locations.insert({
    id: LOCATION,
    brandId: BRAND,
    code: 'KTB',
    name: 'Katubedda',
    timezone: 'Asia/Colombo',
    active: true,
    openShiftId: null,
  });
  await store.devices.insert({
    id: DEVICE.deviceId,
    brandId: BRAND,
    locationId: LOCATION,
    name: 'Counter tablet',
    secretHash: await hashSecret(DEVICE.deviceSecret),
    kind: 'counter',
    active: true,
    registeredBy: 'seed',
    createdAt: T0,
    lastSeenAt: null,
  });
  const now = new Date(T0);
  for (const [id, role, pin] of [
    ['e1', 'cashier', '4826'],
    ['e2', 'manager', '7391'],
    ['e3', 'accounts', '5038'],
    ['e4', 'owner', '6142'],
  ] as const) {
    await store.employees.insert(employee(id, role));
    await setPin(store, BRAND, id, pin, now);
  }
  await store.employees.insert(employee('e5', null, { hasPin: false })); // washer without POS access
  await ensureDefaults(store, BRAND, LOCATION, now);
}

export const TEST_SECRET = 'test-secret-test-secret-test-secret';

export async function testApp(store = createMemoryStore()) {
  const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', PIN_MAX_ATTEMPTS: '3' });
  const app = await buildApp({ env, store, tokens: new DevJwtIssuer(TEST_SECRET) });
  return { app, store };
}

/** Sign in through the real PIN route and return an Authorization header. */
export async function authHeader(
  app: Awaited<ReturnType<typeof testApp>>['app'],
  employeeId: string,
  pin: string,
): Promise<{ authorization: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/pin',
    payload: { ...DEVICE, employeeId, pin },
  });
  if (res.statusCode !== 200) throw new Error(`sign-in failed: ${res.body}`);
  return { authorization: `Bearer ${res.json().token}` };
}

/** Opens a shift directly (until the shift API exists in Phase 5). */
export async function openTestShift(store: MemoryStore, id = 'shift-1'): Promise<string> {
  await store.shifts.insert({
    id,
    brandId: BRAND,
    locationId: LOCATION,
    createdAt: T0,
    createdBy: 'emp:e1',
    updatedAt: null,
    updatedBy: null,
    status: 'OPEN',
    supervisorEmployeeId: 'e1',
    supervisorName: 'Staff e1',
    openedAt: T0,
    businessDate: '2026-11-15',
    checklistId: null,
    openingCount: { notes: {}, coinsCents: 0 },
    openingCents: 0,
    carryoverNotes: null,
    closeId: null,
    closedAt: null,
    approvalId: null,
    backdated: false,
  });
  await store.locations.update(LOCATION, { openShiftId: id });
  return id;
}

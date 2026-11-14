import type { Employee, Role } from '@stopwash/shared';
import type { DataStore } from '../repos';
import { ensureDefaults } from '../services/defaults';
import { hashSecret, setPin } from '../services/pin';

/**
 * Development data for the in-memory backend: one location, one counter device and staff for
 * every role. PINs here are for local development only (the API refuses this seed in production).
 */
export const DEV_STAFF: Array<{
  id: string;
  name: string;
  role: Role | null;
  jobTitle: string;
  pin: string | null;
}> = [
  { id: 'emp-owner', name: 'Saman Jayasuriya', role: 'owner', jobTitle: 'Owner', pin: '6142' },
  { id: 'emp-manager', name: 'Dilani Fernando', role: 'manager', jobTitle: 'Manager', pin: '7391' },
  { id: 'emp-accounts', name: 'Ruwan Silva', role: 'accounts', jobTitle: 'Accounts', pin: '5038' },
  { id: 'emp-cashier', name: 'Kasun Perera', role: 'cashier', jobTitle: 'Supervisor', pin: '4826' },
  {
    id: 'emp-attendant',
    name: 'Tharindu Bandara',
    role: 'cashier',
    jobTitle: 'Washer',
    pin: '3517',
  },
  { id: 'emp-washer', name: 'Nuwan Rathnayake', role: null, jobTitle: 'Washer', pin: null },
];

export interface DevSeedOptions {
  brandId: string;
  locationId: string;
  deviceId: string;
  deviceSecret: string;
  now?: Date;
}

export async function seedDev(store: DataStore, o: DevSeedOptions): Promise<void> {
  const now = o.now ?? new Date();
  const at = now.toISOString();
  if (await store.locations.get(o.locationId)) return; // already seeded
  await store.locations.insert({
    id: o.locationId,
    brandId: o.brandId,
    code: 'KTB',
    name: 'Katubedda',
    timezone: 'Asia/Colombo',
    active: true,
    openShiftId: null,
  });
  await ensureDefaults(store, o.brandId, o.locationId, now);
  await store.devices.insert({
    id: o.deviceId,
    brandId: o.brandId,
    locationId: o.locationId,
    name: 'Counter tablet (dev)',
    secretHash: await hashSecret(o.deviceSecret),
    kind: 'counter',
    active: true,
    registeredBy: 'system',
    createdAt: at,
    lastSeenAt: null,
  });
  for (const [i, s] of DEV_STAFF.entries()) {
    const employee: Employee = {
      id: s.id,
      brandId: o.brandId,
      createdAt: at,
      createdBy: 'system',
      updatedAt: null,
      updatedBy: null,
      code: `SW${String(i + 1).padStart(3, '0')}`,
      name: s.name,
      phone: `+9477${String(1000000 + i * 7919).slice(0, 7)}`,
      jobTitle: s.jobTitle,
      systemRole: s.role,
      locationIds: [o.locationId],
      baseSalaryCents: s.role === 'owner' ? 0 : 4_500_000 + i * 250_000,
      recurringDeductionCents: 0,
      recurringAdditionCents: 0,
      incentiveRuleId: null,
      canOpenShift: s.role === 'manager' || s.jobTitle === 'Supervisor',
      exemptMonths: [],
      active: true,
      hasPin: !!s.pin,
    };
    await store.employees.insert(employee);
    if (s.pin) await setPin(store, o.brandId, s.id, s.pin, now);
  }
}

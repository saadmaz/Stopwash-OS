import { initials } from '@stopwash/shared';
import type { Ctx } from '../lib/context';
import { AppError } from '../lib/errors';
import { eq, type Device, type Repositories } from '../repos';
import { audit } from './audit';
import { compareSecret, DUMMY_HASH, verifyPin, type PinPolicy } from './pin';
import type { AuthTokenIssuer, IssuedToken, TokenSubject } from './tokens';

export async function verifyDevice(
  repos: Pick<Repositories, 'devices'>,
  deviceId: string,
  deviceSecret: string,
): Promise<Device> {
  const device = await repos.devices.get(deviceId);
  // Compare even when the device is unknown so timing doesn't reveal valid ids.
  const ok = await compareSecret(deviceSecret, device?.secretHash ?? DUMMY_HASH);
  if (!device || !device.active || !ok)
    throw new AppError('DEVICE_INVALID', 'This device is not registered');
  return device;
}

export interface StaffTile {
  id: string;
  name: string;
  code: string;
  jobTitle: string;
  initials: string;
  /** System role, so the counter can offer only managers as approvers. */
  role: string | null;
  canOpenShift: boolean;
}

/** Staff who may sign in on this device's location (for the PIN pad). */
export async function staffForDevice(
  repos: Pick<Repositories, 'employees'>,
  device: Device,
): Promise<StaffTile[]> {
  const rows = await repos.employees.find({
    where: [
      eq('brandId', device.brandId),
      eq('active', true),
      { field: 'locationIds', op: 'array-contains', value: device.locationId },
    ],
    orderBy: { field: 'name' },
  });
  return rows
    .filter((e) => e.systemRole && e.hasPin)
    .map((e) => ({
      id: e.id,
      name: e.name,
      code: e.code,
      jobTitle: e.jobTitle,
      initials: initials(e.name),
      role: e.systemRole,
      canOpenShift: e.canOpenShift || e.systemRole === 'manager' || e.systemRole === 'owner',
    }));
}

export interface PinSignInInput {
  deviceId: string;
  deviceSecret: string;
  employeeId: string;
  pin: string;
}

export interface SignInResult extends IssuedToken {
  user: Omit<TokenSubject, 'uid'> & { id: string };
}

export async function signInWithPin(
  store: Repositories & { transaction: <R>(fn: (tx: Repositories) => Promise<R>) => Promise<R> },
  issuer: AuthTokenIssuer,
  input: PinSignInInput,
  meta: { now: Date; requestId: string | null; policy: PinPolicy },
): Promise<SignInResult> {
  const device = await verifyDevice(store, input.deviceId, input.deviceSecret);
  const employee = await store.employees.get(input.employeeId);
  const allowed =
    employee &&
    employee.active &&
    employee.brandId === device.brandId &&
    employee.systemRole !== null &&
    employee.locationIds.includes(device.locationId);
  // Lockout bookkeeping must persist even when the PIN is wrong, so it runs outside a rollback.
  await verifyPin(
    store,
    device.brandId,
    allowed ? employee.id : `none:${input.employeeId}`,
    input.pin,
    meta.now,
    meta.policy,
  );
  if (!allowed || !employee.systemRole) throw new AppError('PIN_INVALID', 'Incorrect PIN');

  const subject: TokenSubject = {
    uid: `emp:${employee.id}`,
    name: employee.name,
    role: employee.systemRole,
    brandId: employee.brandId,
    locationIds: [device.locationId],
    employeeId: employee.id,
    deviceId: device.id,
  };
  const token = await issuer.issue(subject, meta.now);
  const ctx: Ctx = {
    actor: {
      id: subject.uid,
      name: subject.name,
      role: subject.role,
      brandId: subject.brandId,
      locationIds: subject.locationIds,
      employeeId: employee.id,
      deviceId: device.id,
    },
    requestId: meta.requestId,
    now: meta.now,
  };
  await store.transaction(async (tx) => {
    await tx.devices.update(device.id, { lastSeenAt: meta.now.toISOString() });
    await audit(tx, ctx, {
      action: 'auth.pinSignIn',
      entity: 'employee',
      entityId: employee.id,
      locationId: device.locationId,
    });
  });
  const { uid, ...rest } = subject;
  return { ...token, user: { id: uid, ...rest } };
}

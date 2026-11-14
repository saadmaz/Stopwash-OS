import bcrypt from 'bcryptjs';
import { Pin } from '@stopwash/shared';
import { AppError } from '../lib/errors';
import type { EmployeeSecret, Repositories } from '../repos';

/** bcrypt cost. 10 keeps a PIN check around 60–80 ms on a small server. */
const COST = 10;

/** Hash compared against when the employee is unknown, so timing matches a real check. */
export const DUMMY_HASH = bcrypt.hashSync('no-such-employee', COST);

/** PINs that are too easy to guess (old shared passcodes are treated as compromised too). */
const WEAK = new Set(['0000', '1111', '1234', '4321', '9999', '5252', '6225', '0706', '123456']);

export interface PinPolicy {
  maxAttempts: number;
  lockoutMinutes: number;
}

export function assertAcceptablePin(pin: string): void {
  if (!Pin.safeParse(pin).success)
    throw new AppError('VALIDATION_FAILED', 'PIN must be 4–6 digits');
  if (WEAK.has(pin) || /^(\d)\1+$/.test(pin)) {
    throw new AppError('VALIDATION_FAILED', 'PIN is too easy to guess');
  }
}

export function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, COST);
}

export function compareSecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

export async function setPin(
  repos: Pick<Repositories, 'employeeSecrets'>,
  brandId: string,
  employeeId: string,
  pin: string,
  now: Date,
): Promise<void> {
  assertAcceptablePin(pin);
  const record: EmployeeSecret = {
    id: employeeId,
    brandId,
    pinHash: await hashSecret(pin),
    failedAttempts: 0,
    lockedUntil: null,
    pinUpdatedAt: now.toISOString(),
  };
  await repos.employeeSecrets.upsert(record);
}

/**
 * Check a PIN. Wrong PINs count towards a lockout; a correct PIN resets the count.
 * Errors don't reveal whether the employee exists.
 */
export async function verifyPin(
  repos: Pick<Repositories, 'employeeSecrets'>,
  brandId: string,
  employeeId: string,
  pin: string,
  now: Date,
  policy: PinPolicy,
): Promise<void> {
  const secret = await repos.employeeSecrets.get(employeeId);
  if (!secret || secret.brandId !== brandId) {
    await compareSecret(pin, DUMMY_HASH); // same timing as a real check
    throw new AppError('PIN_INVALID', 'Incorrect PIN');
  }
  if (secret.lockedUntil && new Date(secret.lockedUntil) > now) {
    throw new AppError('PIN_LOCKED', 'Too many attempts. Try again later.', {
      lockedUntil: secret.lockedUntil,
    });
  }
  const ok = await compareSecret(pin, secret.pinHash);
  if (ok) {
    if (secret.failedAttempts > 0 || secret.lockedUntil) {
      await repos.employeeSecrets.update(employeeId, { failedAttempts: 0, lockedUntil: null });
    }
    return;
  }
  const failed = secret.failedAttempts + 1;
  const lock = failed >= policy.maxAttempts;
  await repos.employeeSecrets.update(employeeId, {
    failedAttempts: lock ? 0 : failed,
    lockedUntil: lock
      ? new Date(now.getTime() + policy.lockoutMinutes * 60_000).toISOString()
      : null,
  });
  if (lock) {
    throw new AppError('PIN_LOCKED', 'Too many attempts. Try again later.');
  }
  throw new AppError('PIN_INVALID', 'Incorrect PIN', { attemptsLeft: policy.maxAttempts - failed });
}

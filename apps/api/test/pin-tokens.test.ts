import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../src/repos';
import { assertAcceptablePin, setPin, verifyPin } from '../src/services/pin';
import { DevJwtIssuer, FirebaseTokenIssuer } from '../src/services/tokens';
import { NotImplementedError } from '../src/lib/not-implemented';

const policy = { maxAttempts: 3, lockoutMinutes: 15 };
const t0 = new Date('2026-11-15T04:00:00Z');
const later = (min: number) => new Date(t0.getTime() + min * 60_000);

describe('PIN policy', () => {
  it.each(['1234', '0000', '7777', '5252', '6225', '0706', '12'])('rejects %s', (pin) => {
    expect(() => assertAcceptablePin(pin)).toThrow();
  });
  it('accepts a reasonable PIN', () => {
    expect(() => assertAcceptablePin('4826')).not.toThrow();
  });
});

describe('verifyPin', () => {
  it('stores only a hash and verifies the right PIN', async () => {
    const db = createMemoryStore();
    await setPin(db, 'stopwash', 'e1', '4826', t0);
    const stored = await db.employeeSecrets.get('e1');
    expect(stored?.pinHash).not.toContain('4826');
    await expect(verifyPin(db, 'stopwash', 'e1', '4826', t0, policy)).resolves.toBeUndefined();
  });

  it('locks out after repeated failures, then allows again after the lockout', async () => {
    const db = createMemoryStore();
    await setPin(db, 'stopwash', 'e1', '4826', t0);
    await expect(verifyPin(db, 'stopwash', 'e1', '1111', t0, policy)).rejects.toMatchObject({
      code: 'PIN_INVALID',
      details: { attemptsLeft: 2 },
    });
    await expect(verifyPin(db, 'stopwash', 'e1', '1111', t0, policy)).rejects.toMatchObject({
      code: 'PIN_INVALID',
    });
    await expect(verifyPin(db, 'stopwash', 'e1', '1111', t0, policy)).rejects.toMatchObject({
      code: 'PIN_LOCKED',
    });
    // even the right PIN is refused while locked
    await expect(verifyPin(db, 'stopwash', 'e1', '4826', later(5), policy)).rejects.toMatchObject({
      code: 'PIN_LOCKED',
    });
    await expect(
      verifyPin(db, 'stopwash', 'e1', '4826', later(16), policy),
    ).resolves.toBeUndefined();
  });

  it('a correct PIN resets the failure count', async () => {
    const db = createMemoryStore();
    await setPin(db, 'stopwash', 'e1', '4826', t0);
    await expect(verifyPin(db, 'stopwash', 'e1', '9998', t0, policy)).rejects.toThrow();
    await verifyPin(db, 'stopwash', 'e1', '4826', t0, policy);
    expect((await db.employeeSecrets.get('e1'))?.failedAttempts).toBe(0);
  });

  it('gives the same answer for unknown employees and other brands', async () => {
    const db = createMemoryStore();
    await setPin(db, 'stopwash', 'e1', '4826', t0);
    await expect(verifyPin(db, 'stopwash', 'nobody', '4826', t0, policy)).rejects.toMatchObject({
      code: 'PIN_INVALID',
    });
    await expect(verifyPin(db, 'otherbrand', 'e1', '4826', t0, policy)).rejects.toMatchObject({
      code: 'PIN_INVALID',
    });
  });
});

describe('token issuers', () => {
  const subject = {
    uid: 'emp:e1',
    name: 'Kasun',
    role: 'cashier' as const,
    brandId: 'stopwash',
    locationIds: ['katubedda'],
    employeeId: 'e1',
    deviceId: 'd1',
  };

  it('dev issuer round-trips claims and expires', async () => {
    const issuer = new DevJwtIssuer('x'.repeat(32), 60);
    const { token, expiresAt } = await issuer.issue(subject, new Date());
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
    await expect(issuer.verify(token)).resolves.toEqual(subject);
    const old = await issuer.issue(subject, new Date(Date.now() - 2 * 3600_000));
    await expect(issuer.verify(old.token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects tokens signed with another secret', async () => {
    const a = new DevJwtIssuer('a'.repeat(32));
    const b = new DevJwtIssuer('b'.repeat(32));
    const { token } = await a.issue(subject, new Date());
    await expect(b.verify(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('refuses a short dev secret', () => {
    expect(() => new DevJwtIssuer('short')).toThrow(/32/);
  });

  it('firebase issuer is a stub until Firebase is configured', async () => {
    await expect(new FirebaseTokenIssuer().issue()).rejects.toBeInstanceOf(NotImplementedError);
  });
});

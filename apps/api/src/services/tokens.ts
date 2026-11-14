import { parseClaims, type StopwashClaims } from '@stopwash/shared';
import { jwtVerify, SignJWT } from 'jose';
import { AppError } from '../lib/errors';
import { NotImplementedError } from '../lib/not-implemented';

export interface IssuedToken {
  token: string;
  expiresAt: string;
}

export interface TokenSubject extends StopwashClaims {
  uid: string;
  name: string;
}

/**
 * Issues sign-in tokens after a successful PIN or email check, and verifies them on each request.
 * Dev: HS256 JWT signed with AUTH_DEV_SECRET. Production: Firebase custom tokens (stub for now).
 */
export interface AuthTokenIssuer {
  readonly kind: 'dev' | 'firebase';
  issue(subject: TokenSubject, now: Date): Promise<IssuedToken>;
  verify(token: string): Promise<TokenSubject>;
}

const ISSUER = 'stopwash-api';
const AUDIENCE = 'stopwash-pos';

export class DevJwtIssuer implements AuthTokenIssuer {
  readonly kind = 'dev' as const;
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlMinutes = 12 * 60,
  ) {
    if (secret.length < 32) throw new Error('AUTH_DEV_SECRET must be at least 32 characters');
    this.key = new TextEncoder().encode(secret);
  }

  async issue(s: TokenSubject, now: Date): Promise<IssuedToken> {
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + this.ttlMinutes * 60;
    const token = await new SignJWT({
      name: s.name,
      role: s.role,
      brandId: s.brandId,
      locationIds: s.locationIds,
      employeeId: s.employeeId ?? null,
      deviceId: s.deviceId ?? null,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(s.uid)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.key);
    return { token, expiresAt: new Date(exp * 1000).toISOString() };
  }

  async verify(token: string): Promise<TokenSubject> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      const claims = parseClaims(payload);
      if (!claims || !payload.sub || typeof payload.name !== 'string')
        throw new Error('bad claims');
      return { ...claims, uid: payload.sub, name: payload.name };
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Session expired or invalid. Sign in again.');
    }
  }
}

/** Production issuer: Firebase custom tokens + ID token verification. Wired up with Firebase. */
export class FirebaseTokenIssuer implements AuthTokenIssuer {
  readonly kind = 'firebase' as const;
  async issue(): Promise<IssuedToken> {
    throw new NotImplementedError(
      'Firebase custom tokens: wire up when Firebase is configured (admin.auth().createCustomToken)',
    );
  }
  async verify(): Promise<TokenSubject> {
    throw new NotImplementedError(
      'Firebase ID token verification: wire up when Firebase is configured (admin.auth().verifyIdToken)',
    );
  }
}

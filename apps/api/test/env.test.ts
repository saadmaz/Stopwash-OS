import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';

describe('environment guards', () => {
  const prod = { NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'stopwash-prod' };

  it('refuses the dev seed and memory backend in production', () => {
    expect(() => loadEnv({ ...prod, AUTH_ISSUER: 'firebase' })).toThrow(/DEV_SEED=false/);
    expect(() =>
      loadEnv({ ...prod, AUTH_ISSUER: 'firebase', DEV_SEED: 'false', DATA_BACKEND: 'memory' }),
    ).toThrow(/DATA_BACKEND=firestore/);
  });

  it('refuses dev tokens in production', () => {
    expect(() => loadEnv({ ...prod, DEV_SEED: 'false', DATA_BACKEND: 'firestore' })).toThrow(
      /AUTH_ISSUER=dev/,
    );
  });
});

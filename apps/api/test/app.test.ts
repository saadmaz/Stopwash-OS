import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../src/app';
import { loadEnv } from '../src/env';
import { AppError } from '../src/lib/errors';
import { validate } from '../src/lib/validate';

const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });

describe('api foundation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      env,
      plugins: [
        async (a) => {
          a.post('/echo', async (req) => validate(z.object({ name: z.string().min(1) }), req.body));
          a.get('/boom', async () => {
            throw new Error('kaboom');
          });
          a.get('/forbidden', async () => {
            throw new AppError('FORBIDDEN', 'nope');
          });
        },
      ],
    });
  });
  afterAll(() => app.close());

  it('reports health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'stopwash-api' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a caller-supplied request id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'abc-123' },
    });
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('returns structured validation errors', async () => {
    const res = await app.inject({ method: 'POST', url: '/echo', payload: { name: '' } });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details[0].path).toBe('name');
  });

  it('maps AppError to its status and code', async () => {
    const res = await app.inject({ method: 'GET', url: '/forbidden' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('hides internals on unexpected errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('sets security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('env', () => {
  it('refuses a real project id outside production', () => {
    expect(() =>
      loadEnv({ NODE_ENV: 'development', FIREBASE_PROJECT_ID: 'stopwash-dashboard-001' }),
    ).toThrow(/demo-/);
  });

  it('refuses emulator hosts in production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        FIREBASE_PROJECT_ID: 'prod',
        FIRESTORE_EMULATOR_HOST: 'x:1',
      }),
    ).toThrow(/production/);
  });
});

import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { loadEnv } from '../src/env';
import { NotImplementedError } from '../src/lib/not-implemented';
import { createDataStore } from '../src/repos';

describe('DATA_BACKEND switch', () => {
  it('defaults to memory', () => {
    expect(loadEnv({ NODE_ENV: 'test' }).DATA_BACKEND).toBe('memory');
    expect(createDataStore({ DATA_BACKEND: 'memory' }).backend).toBe('memory');
  });

  it('firestore adapter is a stub that says what to do', async () => {
    const store = createDataStore({ DATA_BACKEND: 'firestore' });
    expect(store.backend).toBe('firestore');
    await expect(store.orders.get('x')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(store.orders.get('x')).rejects.toThrow(/wire up when Firebase is configured/);
    await expect(store.transaction(async () => 1)).rejects.toBeInstanceOf(NotImplementedError);
    await expect(store.counters.next('b', 'k')).rejects.toBeInstanceOf(NotImplementedError);
  });

  it('health reports the backend; a stub error becomes 501', async () => {
    const env = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', DATA_BACKEND: 'firestore' });
    const app = await buildApp({
      env,
      plugins: [async (a) => void a.get('/probe', () => a.store.orders.get('x'))],
    });
    expect((await app.inject({ url: '/health' })).json().dataBackend).toBe('firestore');
    const res = await app.inject({ url: '/probe' });
    expect(res.statusCode).toBe(501);
    expect(res.json().error.code).toBe('NOT_IMPLEMENTED');
    await app.close();
  });
});

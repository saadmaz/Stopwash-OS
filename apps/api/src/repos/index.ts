import type { Env } from '../env';
import { createFirestoreStore } from './firestore';
import { createMemoryStore } from './memory';
import type { DataStore } from './types';

export * from './types';
export { createMemoryStore, type MemoryStore } from './memory';

export function createDataStore(env: Pick<Env, 'DATA_BACKEND'>): DataStore {
  return env.DATA_BACKEND === 'firestore' ? createFirestoreStore() : createMemoryStore();
}

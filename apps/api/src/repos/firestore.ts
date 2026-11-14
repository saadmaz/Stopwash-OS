import { FIRESTORE_TODO, NotImplementedError } from '../lib/not-implemented';
import type {
  CounterRepo,
  DataStore,
  FindOptions,
  Identified,
  MutableRepo,
  Repositories,
} from './types';

/**
 * Firestore backend: interface only for now. Saad wires this up once the Firebase project exists:
 * each collection maps to a top-level Firestore collection of the same name (see docs/DATA_MODEL.md),
 * `transaction` maps to `db.runTransaction`, timestamps convert ISO string ⇄ Firestore Timestamp.
 */
class FirestoreCollection<T extends Identified> implements MutableRepo<T> {
  constructor(readonly collection: string) {}
  private fail(): never {
    throw new NotImplementedError(`${FIRESTORE_TODO} (${this.collection})`);
  }
  async get(_id: string): Promise<T | null> {
    return this.fail();
  }
  async find(_opts: FindOptions<T>): Promise<T[]> {
    return this.fail();
  }
  async count(_opts: FindOptions<T>): Promise<number> {
    return this.fail();
  }
  async insert(_doc: T): Promise<T> {
    return this.fail();
  }
  async update(_id: string, _patch: Partial<T>): Promise<T> {
    return this.fail();
  }
  async upsert(_doc: T): Promise<T> {
    return this.fail();
  }
}

const COLLECTIONS: Exclude<keyof Repositories, 'counters'>[] = [
  'locations',
  'settings',
  'catalog',
  'checklistItems',
  'cashCategories',
  'customers',
  'vehicles',
  'orders',
  'payments',
  'shifts',
  'checklists',
  'cashMovements',
  'shiftCloses',
  'shiftApprovals',
  'alerts',
  'users',
  'employees',
  'employeeSecrets',
  'devices',
  'attendance',
  'leaves',
  'incentiveRules',
  'payrollAdjustments',
  'payrollRuns',
  'invoices',
  'audit',
  'idempotency',
];

export function createFirestoreStore(): DataStore {
  const counters: CounterRepo = {
    next: () => Promise.reject(new NotImplementedError(`${FIRESTORE_TODO} (counters)`)),
  };
  const repos = Object.fromEntries(
    COLLECTIONS.map((c) => [c, new FirestoreCollection(c)]),
  ) as unknown as Omit<Repositories, 'counters'>;
  return {
    ...repos,
    counters,
    backend: 'firestore',
    transaction: () => Promise.reject(new NotImplementedError(`${FIRESTORE_TODO} (transaction)`)),
  };
}

import { AsyncLocalStorage } from 'node:async_hooks';
import { AppError } from '../lib/errors';
import {
  APPEND_ONLY,
  type Cond,
  type CounterRepo,
  type DataStore,
  type FindOptions,
  type Identified,
  type MutableRepo,
  type Repositories,
} from './types';

type Table = Map<string, unknown>;
type Tables = Map<string, Table>;

function matches<T>(doc: T, c: Cond<T>): boolean {
  const v = (doc as Record<string, unknown>)[c.field];
  switch (c.op) {
    case '==':
      return v === c.value;
    case '!=':
      return v !== c.value;
    case '<':
      return (v as never) < (c.value as never);
    case '<=':
      return (v as never) <= (c.value as never);
    case '>':
      return (v as never) > (c.value as never);
    case '>=':
      return (v as never) >= (c.value as never);
    case 'in':
      return Array.isArray(c.value) && c.value.includes(v);
    case 'array-contains':
      return Array.isArray(v) && v.includes(c.value);
  }
}

const clone = <T>(v: T): T => structuredClone(v);

class MemoryCollection<T extends Identified> implements MutableRepo<T> {
  constructor(
    private readonly tables: () => Tables,
    private readonly name: string,
    private readonly appendOnly: boolean,
  ) {}

  private get table(): Table {
    const all = this.tables();
    let t = all.get(this.name);
    if (!t) {
      t = new Map();
      all.set(this.name, t);
    }
    return t;
  }

  async get(id: string): Promise<T | null> {
    const v = this.table.get(id);
    return v ? clone(v as T) : null;
  }

  private select(opts: FindOptions<T>): T[] {
    // Same guarantee the Firestore rules give: no query may cross brands.
    if (!opts.where.some((c) => c.field === 'brandId' && c.op === '==')) {
      throw new Error(`Unscoped query on ${this.name}: every query must filter on brandId`);
    }
    let rows = [...this.table.values()].filter((d) =>
      opts.where.every((c) => matches(d as T, c)),
    ) as T[];
    if (opts.orderBy) {
      const { field, dir = 'asc' } = opts.orderBy;
      const sign = dir === 'asc' ? 1 : -1;
      rows = rows.sort((a, b) => {
        const x = (a as Record<string, unknown>)[field] as never;
        const y = (b as Record<string, unknown>)[field] as never;
        return x < y ? -sign : x > y ? sign : 0;
      });
    }
    const start = opts.offset ?? 0;
    return rows.slice(start, opts.limit === undefined ? undefined : start + opts.limit);
  }

  async find(opts: FindOptions<T>): Promise<T[]> {
    return this.select(opts).map(clone);
  }

  async count(opts: FindOptions<T>): Promise<number> {
    return this.select({ ...opts, limit: undefined, offset: undefined }).length;
  }

  async insert(doc: T): Promise<T> {
    if (this.table.has(doc.id))
      throw new AppError('CONFLICT', `${this.name}/${doc.id} already exists`);
    this.table.set(doc.id, clone(doc));
    return clone(doc);
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    if (this.appendOnly) throw new Error(`${this.name} is append-only`);
    const current = this.table.get(id) as T | undefined;
    if (!current) throw new AppError('NOT_FOUND', `${this.name}/${id} not found`);
    const next = { ...current, ...clone(patch), id };
    this.table.set(id, next);
    return clone(next);
  }

  async upsert(doc: T): Promise<T> {
    if (this.appendOnly) throw new Error(`${this.name} is append-only`);
    this.table.set(doc.id, clone(doc));
    return clone(doc);
  }
}

/** In-memory backend for development and tests. Transactions are serialised and roll back on error. */
class MemoryEngine {
  private tables: Tables = new Map();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly inTx = new AsyncLocalStorage<true>();
  readonly repos: Repositories;

  constructor() {
    const t = () => this.tables;
    const col = <T extends Identified>(name: keyof Repositories) =>
      new MemoryCollection<T>(t, name, APPEND_ONLY.has(name));
    const counters: CounterRepo = {
      next: async (brandId, key, start = 1) => {
        const table = col<{ id: string; brandId: string; value: number }>('counters');
        const id = `${brandId}__${key}`;
        const cur = await table.get(id);
        const value = cur ? cur.value + 1 : start;
        await table.upsert({ id, brandId, value });
        return value;
      },
    };
    this.repos = {
      locations: col('locations'),
      settings: col('settings'),
      catalog: col('catalog'),
      checklistItems: col('checklistItems'),
      cashCategories: col('cashCategories'),
      customers: col('customers'),
      vehicles: col('vehicles'),
      orders: col('orders'),
      payments: col('payments'),
      shifts: col('shifts'),
      checklists: col('checklists'),
      cashMovements: col('cashMovements'),
      shiftCloses: col('shiftCloses'),
      shiftApprovals: col('shiftApprovals'),
      alerts: col('alerts'),
      users: col('users'),
      employees: col('employees'),
      employeeSecrets: col('employeeSecrets'),
      devices: col('devices'),
      attendance: col('attendance'),
      leaves: col('leaves'),
      incentiveRules: col('incentiveRules'),
      payrollAdjustments: col('payrollAdjustments'),
      payrollRuns: col('payrollRuns'),
      invoices: col('invoices'),
      audit: col('audit'),
      idempotency: col('idempotency'),
      counters,
    };
  }

  async transaction<R>(fn: (tx: Repositories) => Promise<R>): Promise<R> {
    if (this.inTx.getStore()) return fn(this.repos); // nested call: join the outer transaction
    const run = async () => {
      const snapshot = new Map([...this.tables].map(([k, v]) => [k, new Map(v)]));
      try {
        return await this.inTx.run(true, () => fn(this.repos));
      } catch (err) {
        this.tables = snapshot; // roll back every write made inside fn
        throw err;
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Test helper: drop everything. */
  reset(): void {
    this.tables = new Map();
  }
}

export type MemoryStore = DataStore & { reset(): void };

export function createMemoryStore(): MemoryStore {
  const engine = new MemoryEngine();
  return {
    ...engine.repos,
    backend: 'memory',
    transaction: (fn) => engine.transaction(fn),
    reset: () => engine.reset(),
  };
}

import { useSyncExternalStore } from 'react';
import { api, ApiError } from './api';

/**
 * Offline outbox for new orders. Each entry keeps the idempotency key it was first sent with, so
 * replaying after a dropped connection can never create the order twice (the API dedupes).
 * Stored in IndexedDB so a reload or a closed tab does not lose orders; memory-only where
 * IndexedDB is missing (tests, private modes).
 */
export interface OutboxItem {
  key: string;
  path: string;
  body: unknown;
  label: string;
  createdAt: string;
  error: string | null;
}

const DB = 'stopwash-outbox';
const STORE = 'items';
let items: OutboxItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function db(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persist(op: (s: IDBObjectStore) => void) {
  try {
    const d = await db();
    if (!d) return;
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    d.close();
  } catch {
    // Storage blocked: the memory copy still works for this session.
  }
}

export async function loadOutbox(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const d = await db();
    if (!d) return;
    const stored = await new Promise<OutboxItem[]>((resolve, reject) => {
      const req = d.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as OutboxItem[]);
      req.onerror = () => reject(req.error);
    });
    d.close();
    const known = new Set(items.map((i) => i.key));
    items = [...items, ...stored.filter((s) => !known.has(s.key))].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    emit();
  } catch {
    // ignore: nothing stored
  }
}

export async function enqueue(item: Omit<OutboxItem, 'createdAt' | 'error'>): Promise<void> {
  const full: OutboxItem = { ...item, createdAt: new Date().toISOString(), error: null };
  items = [...items.filter((i) => i.key !== item.key), full];
  emit();
  await persist((s) => s.put(full));
}

export async function discard(key: string): Promise<void> {
  items = items.filter((i) => i.key !== key);
  emit();
  await persist((s) => s.delete(key));
}

let flushing: Promise<number> | null = null;

/** Sends pending items in order. Stops at the first network failure. Returns how many were sent. */
export function flushOutbox(): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;
    for (const item of items.filter((i) => !i.error)) {
      try {
        await api(item.path, { body: item.body, idempotencyKey: item.key });
        await discard(item.key);
        sent++;
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) break;
        // Rejected by the server (e.g. no open shift): keep it visible for the cashier to resolve.
        const code = e instanceof ApiError ? e.code : 'INTERNAL';
        items = items.map((i) => (i.key === item.key ? { ...i, error: code } : i));
        emit();
        const failed = items.find((i) => i.key === item.key);
        if (failed) await persist((s) => s.put(failed));
      }
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
}

/** Test hook. */
export function resetOutboxForTests() {
  items = [];
  loaded = false;
  emit();
}

import type { OrderStatus } from './schemas/operations';

/**
 * Floor flow: QUEUED → IN_PROGRESS → READY → COMPLETED (only via checkout).
 * Steps may be skipped forwards (a quick bike wash can go straight to READY) and stepped back one
 * place to undo a mis-tap. CANCELLED is reachable from any state before COMPLETED.
 */
const FLOOR: OrderStatus[] = ['QUEUED', 'IN_PROGRESS', 'READY'];

export function canMoveTo(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (from === 'COMPLETED' || from === 'CANCELLED') return false;
  if (to === 'COMPLETED') return false; // checkout only
  if (to === 'CANCELLED') return true;
  const a = FLOOR.indexOf(from);
  const b = FLOOR.indexOf(to);
  return a >= 0 && b >= 0 && (b > a || b === a - 1);
}

export function nextFloorStatus(from: OrderStatus): OrderStatus | null {
  const i = FLOOR.indexOf(from);
  return i >= 0 && i < FLOOR.length - 1 ? FLOOR[i + 1]! : null;
}

export const isOpen = (s: OrderStatus) => s !== 'COMPLETED' && s !== 'CANCELLED';

/** Orders the queue: open orders by status then oldest first; finished ones newest first. */
export function queueSort<
  T extends { status: OrderStatus; createdAt: string; completedAt: string | null },
>(a: T, b: T): number {
  const rank: Record<OrderStatus, number> = {
    READY: 0,
    IN_PROGRESS: 1,
    QUEUED: 2,
    COMPLETED: 3,
    CANCELLED: 4,
  };
  if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
  if (isOpen(a.status)) return a.createdAt.localeCompare(b.createdAt);
  return (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt);
}

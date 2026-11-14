import { describe, expect, it } from 'vitest';
import { canMoveTo, nextFloorStatus, queueSort, type OrderStatus } from '../src';

describe('order status flow', () => {
  it.each([
    ['QUEUED', 'IN_PROGRESS', true],
    ['QUEUED', 'READY', true], // skip ahead
    ['IN_PROGRESS', 'READY', true],
    ['IN_PROGRESS', 'QUEUED', true], // undo one step
    ['READY', 'QUEUED', false], // only one step back
    ['READY', 'COMPLETED', false], // checkout only
    ['QUEUED', 'CANCELLED', true],
    ['READY', 'CANCELLED', true],
    ['COMPLETED', 'CANCELLED', false], // refund instead
    ['CANCELLED', 'QUEUED', false],
    ['QUEUED', 'QUEUED', false],
  ] as const)('%s → %s = %s', (from, to, ok) => {
    expect(canMoveTo(from as OrderStatus, to as OrderStatus)).toBe(ok);
  });

  it('suggests the next floor step', () => {
    expect(nextFloorStatus('QUEUED')).toBe('IN_PROGRESS');
    expect(nextFloorStatus('IN_PROGRESS')).toBe('READY');
    expect(nextFloorStatus('READY')).toBeNull();
  });

  it('sorts ready cars first, open orders oldest first, finished newest first', () => {
    const o = (
      id: string,
      status: OrderStatus,
      createdAt: string,
      completedAt: string | null = null,
    ) => ({
      id,
      status,
      createdAt,
      completedAt,
    });
    const rows = [
      o('done-old', 'COMPLETED', '2026-11-15T01:00:00Z', '2026-11-15T02:00:00Z'),
      o('q-new', 'QUEUED', '2026-11-15T05:00:00Z'),
      o('ready', 'READY', '2026-11-15T03:00:00Z'),
      o('q-old', 'QUEUED', '2026-11-15T04:00:00Z'),
      o('done-new', 'COMPLETED', '2026-11-15T01:30:00Z', '2026-11-15T06:00:00Z'),
    ].sort(queueSort);
    expect(rows.map((r) => r.id)).toEqual(['ready', 'q-old', 'q-new', 'done-new', 'done-old']);
  });
});

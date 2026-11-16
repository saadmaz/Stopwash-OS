import type { Order, OrderStatus } from '@stopwash/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface QueuePage {
  items: Order[];
  total: number;
  page: number;
  pageCount: number;
  date: string;
  target: { completed: number; target: number };
}

export interface QueueFilter {
  status: 'OPEN' | 'ALL' | 'COMPLETED';
  q: string;
  page: number;
  pageSize?: number;
}

/** Live queue. Polls every 5 s until Firestore listeners replace it (ADR-0032). */
export function useQueue(f: QueueFilter) {
  const params = new URLSearchParams({ page: String(f.page), pageSize: String(f.pageSize ?? 10) });
  if (f.status !== 'ALL') params.set('status', f.status);
  if (f.q.trim()) params.set('q', f.q.trim());
  return useQuery({
    queryKey: ['orders', 'queue', f],
    queryFn: ({ signal }) => api<QueuePage>(`/orders?${params}`, { signal }),
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  });
}

export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: OrderStatus; reason?: string }) =>
      api<Order>(`/orders/${v.id}/status`, {
        body: { status: v.status, reason: v.reason },
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export const STATUS_TONE: Record<
  OrderStatus,
  'warning' | 'info' | 'success' | 'neutral' | 'danger'
> = {
  QUEUED: 'warning',
  IN_PROGRESS: 'info',
  READY: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
};

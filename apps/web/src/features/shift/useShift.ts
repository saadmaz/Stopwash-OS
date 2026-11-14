import type { Shift } from '@stopwash/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCurrentShift() {
  return useQuery({
    queryKey: ['shift', 'current'],
    queryFn: () => api<{ shift: Shift | null }>('/shifts/current'),
    refetchInterval: 30_000,
  });
}

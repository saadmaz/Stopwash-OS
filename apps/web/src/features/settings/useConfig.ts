import type { CashCategory, CatalogItem, ChecklistItem, Settings } from '@stopwash/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LocationConfig {
  locationId: string;
  settings: Settings;
  catalog: CatalogItem[];
  checklistItems: ChecklistItem[];
  cashCategories: CashCategory[];
}

export const configKey = (includeInactive: boolean) => ['config', { includeInactive }] as const;

/** Location configuration. The counter uses active items; admin screens include inactive ones. */
export function useConfig(includeInactive = false) {
  return useQuery({
    queryKey: configKey(includeInactive),
    queryFn: () => api<LocationConfig>(`/config${includeInactive ? '?includeInactive=true' : ''}`),
    staleTime: 5 * 60_000,
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => api<Settings>('/settings', { method: 'PUT', body: s }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  });
}

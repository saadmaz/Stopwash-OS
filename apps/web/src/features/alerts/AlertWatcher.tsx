import type { Alert } from '@stopwash/shared';
import { toast } from '@stopwash/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const POLL_MS = 30_000;

/**
 * Raises a toast for each new manager alert (variance, low stock, equipment fault).
 * Polls until Firestore listeners replace it (D-032). "Got it" acknowledges for this person only.
 */
export function AlertWatcher() {
  const { can } = useSession();
  const { t } = useTranslation();
  const enabled = can('alert.read');
  const seen = useRef(new Set<string>());
  const q = useQuery({
    queryKey: ['alerts'],
    queryFn: ({ signal }) => api<{ items: Alert[] }>('/alerts', { signal }),
    enabled,
    refetchInterval: POLL_MS,
  });
  useEffect(() => {
    for (const a of q.data?.items ?? []) {
      if (seen.current.has(a.id)) continue;
      seen.current.add(a.id);
      const show = a.severity === 'danger' ? toast.error : toast.warning;
      show(t(`alerts.kind.${a.kind}`), {
        id: `alert-${a.id}`,
        description: a.message,
        duration: Infinity,
        action: {
          label: t('alerts.ack'),
          onClick: () => void api(`/alerts/${a.id}/ack`, { method: 'POST' }).catch(() => {}),
        },
      });
    }
  }, [q.data, t]);
  return null;
}

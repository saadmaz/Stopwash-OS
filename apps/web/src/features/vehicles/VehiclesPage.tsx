import {
  formatLKR,
  summarizeLines,
  type Customer,
  type Order,
  type Vehicle,
} from '@stopwash/shared';
import { Badge, EmptyState, Input, Skeleton, StatCard } from '@stopwash/ui';
import { useQuery } from '@tanstack/react-query';
import { CarFront, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS_TONE } from '@/features/queue/useQueue';
import { api, ApiError, errorKey } from '@/lib/api';

interface History {
  vehicle: Vehicle;
  customer: Customer | null;
  orders: Order[];
}
interface Lookup {
  vehicles: Array<Vehicle & { customer: { name: string | null; phone: string | null } | null }>;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  });

export function VehicleHistory({ data }: { data: History }) {
  const { t } = useTranslation();
  const { vehicle: v, customer: c, orders } = data;
  return (
    <section aria-labelledby="vh-plate" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 id="vh-plate" className="font-display text-3xl font-bold tracking-wider">
          {v.plateDisplay}
        </h2>
        {v.vehicleClassCode && <Badge>{v.vehicleClassCode}</Badge>}
        {c && (
          <span className="text-fg-muted">{[c.name, c.phone].filter(Boolean).join(' · ')}</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('vehicles.visits')} value={String(v.visitCount)} />
        <StatCard label={t('vehicles.spent')} value={formatLKR(v.totalSpentCents)} />
        <StatCard label={t('vehicles.firstSeen')} value={day(v.firstSeenAt)} />
        <StatCard label={t('vehicles.lastSeen')} value={day(v.lastSeenAt)} />
      </div>
      {orders.length === 0 ? (
        <EmptyState title={t('vehicles.noOrders')} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="w-28 text-sm text-fg-muted">{day(o.createdAt)}</span>
              <span className="min-w-0 flex-1 truncate">{summarizeLines(o.lines)}</span>
              {o.number && <span className="text-xs text-fg-muted">#{o.number}</span>}
              <Badge tone={STATUS_TONE[o.status]}>{t(`queue.status.${o.status}`)}</Badge>
              <span className="tabular w-28 text-right font-semibold">
                {formatLKR(o.totalCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function VehiclesPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [plate, setPlate] = useState<string | null>(null);
  const term = q.trim();
  const matches = useQuery({
    queryKey: ['lookup', 'plate', term],
    queryFn: ({ signal }) => api<Lookup>(`/lookup?plate=${encodeURIComponent(term)}`, { signal }),
    enabled: term.length >= 2,
  });
  const history = useQuery({
    queryKey: ['vehicle', plate],
    queryFn: () => api<History>(`/vehicles/${encodeURIComponent(plate!)}`),
    enabled: !!plate,
    retry: false,
  });
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('nav.vehicles')}</h1>
      <form
        role="search"
        className="flex max-w-xl flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (term) setPlate(term);
        }}
      >
        <Input
          aria-label={t('vehicles.search')}
          placeholder={t('vehicles.search')}
          leading={<Search aria-hidden className="size-4" />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {!!matches.data?.vehicles.length && (
          <ul aria-label={t('vehicles.matches')} className="flex flex-wrap gap-2">
            {matches.data.vehicles.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
                  onClick={() => setPlate(v.plateKey)}
                >
                  <span className="font-semibold">{v.plateDisplay}</span>
                  {v.customer?.name && <span className="text-fg-muted"> · {v.customer.name}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      {!plate ? (
        <EmptyState icon={<CarFront />} title={t('vehicles.prompt')} />
      ) : history.isLoading ? (
        <Skeleton className="h-60" />
      ) : history.error ? (
        <EmptyState
          tone={
            history.error instanceof ApiError && history.error.status === 404 ? undefined : 'danger'
          }
          title={
            history.error instanceof ApiError && history.error.status === 404
              ? t('vehicles.unknown')
              : t(errorKey(history.error))
          }
        />
      ) : (
        history.data && <VehicleHistory data={history.data} />
      )}
    </div>
  );
}

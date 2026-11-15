import { formatLKR } from '@stopwash/shared';
import { EmptyState, SegmentedControl, Select, Skeleton, StatCard } from '@stopwash/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Car, Clock, Receipt, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@/features/settings/useConfig';
import { api, errorKey } from '@/lib/api';
import { HourHeatmap, RevenueBars, SplitBar } from './charts';

interface Summary {
  count: number;
  revenueCents: number;
  avgTicketCents: number;
}
interface Dashboard {
  date: string;
  today: Summary;
  lastWeek: Summary;
  target: { completed: number; target: number };
  openOrders: number;
  heatmap: { since: string; cents: number[][] };
}
interface Analytics {
  sales: {
    current: Summary;
    previous: Summary;
    changePct: number | null;
    series: Array<{ date: string; revenueCents: number; count: number }>;
  };
  retention: {
    returning: number;
    new: number;
    total: number;
    retentionPct: number;
    newPct: number;
  };
}
type Period = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<Period>('WEEKLY');
  const [item, setItem] = useState('ALL');
  const config = useConfig();
  const d = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/dashboard'),
    refetchInterval: 60_000,
  });
  const a = useQuery({
    queryKey: ['analytics', period, item],
    queryFn: () =>
      api<Analytics>(`/analytics?period=${period}${item !== 'ALL' ? `&item=${item}` : ''}`),
    placeholderData: keepPreviousData,
  });
  if (d.isError) return <EmptyState tone="danger" title={t(errorKey(d.error))} />;
  const x = d.data;
  const s = a.data?.sales;
  const r = a.data?.retention;
  const vsLastWeek = t('dashboard.vsLastWeek');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('nav.dashboard')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.revenueToday')}
          icon={<TrendingUp />}
          loading={!x}
          value={x ? formatLKR(x.today.revenueCents) : ''}
          deltaPct={x ? delta(x.today.revenueCents, x.lastWeek.revenueCents) : null}
          deltaLabel={vsLastWeek}
        />
        <StatCard
          label={t('dashboard.vehicles')}
          icon={<Car />}
          loading={!x}
          value={x ? `${x.target.completed} / ${x.target.target}` : ''}
          progress={x ? (x.target.completed / Math.max(1, x.target.target)) * 100 : 0}
        />
        <StatCard
          label={t('dashboard.avgTicket')}
          icon={<Receipt />}
          loading={!x}
          value={x ? formatLKR(x.today.avgTicketCents) : ''}
          deltaPct={x ? delta(x.today.avgTicketCents, x.lastWeek.avgTicketCents) : null}
          deltaLabel={vsLastWeek}
        />
        <StatCard
          label={t('dashboard.inQueue')}
          icon={<Clock />}
          loading={!x}
          value={x?.openOrders ?? ''}
        />
      </div>

      <section
        aria-labelledby="sales"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sales" className="font-display text-lg font-bold">
            {t('dashboard.sales')}
          </h2>
          <div className="flex flex-wrap gap-2">
            <SegmentedControl
              aria-label={t('payroll.period')}
              className="w-auto"
              value={period}
              onValueChange={(v) => setPeriod(v as Period)}
              options={(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((p) => ({
                value: p,
                label: t(`dashboard.periods.${p}`),
              }))}
            />
            <Select
              aria-label={t('dashboard.item')}
              className="w-48"
              value={item}
              onValueChange={setItem}
              options={[
                { value: 'ALL', label: t('dashboard.allItems') },
                ...(config.data?.catalog ?? []).map((c) => ({
                  value: c.code,
                  label: (c.name as Record<string, string | undefined>)[i18n.language] || c.name.en,
                })),
              ]}
            />
          </div>
        </div>
        {!s ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label={t('reports.total')}
                value={formatLKR(s.current.revenueCents)}
                deltaPct={s.changePct}
                deltaLabel={t('dashboard.vsPrevious')}
              />
              <StatCard label={t('payroll.vehicles')} value={s.current.count} />
              <StatCard
                label={t('dashboard.avgTicket')}
                value={formatLKR(s.current.avgTicketCents)}
              />
            </div>
            <RevenueBars series={s.series} label={t('dashboard.dailyRevenue')} />
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="ret"
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <h2 id="ret" className="font-display text-lg font-bold">
            {t('dashboard.retention')}
          </h2>
          {!r ? (
            <Skeleton className="h-24" />
          ) : r.total === 0 ? (
            <p className="text-sm text-fg-muted">{t('dashboard.noVisits')}</p>
          ) : (
            <>
              <SplitBar
                parts={[
                  { label: t('dashboard.returning'), value: r.returning, pct: r.retentionPct },
                  { label: t('dashboard.new'), value: r.new, pct: r.newPct },
                ]}
              />
              <p className="text-sm text-fg-muted">
                {t('dashboard.retentionInsight', {
                  total: r.total,
                  returning: r.returning,
                  pct: r.retentionPct,
                })}
              </p>
            </>
          )}
        </section>
        <section
          aria-labelledby="heat"
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <h2 id="heat" className="font-display text-lg font-bold">
            {t('dashboard.heatmap')}
          </h2>
          {!x ? (
            <Skeleton className="h-48" />
          ) : (
            <HourHeatmap
              cents={x.heatmap.cents}
              caption={t('dashboard.heatmapCaption', { since: x.heatmap.since })}
            />
          )}
        </section>
      </div>
    </div>
  );
}

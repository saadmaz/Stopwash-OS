import { formatLKR } from '@stopwash/shared';
import { Button, EmptyState, Input, Skeleton, StatCard, toast } from '@stopwash/ui';
import { useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '@/features/receipt/receiptPdf';
import { api, apiBlob, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';
import { dailyRevenuePdf, type DailyReport } from './dailyRevenuePdf';

const colomboDay = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(d);
};

export function ReportsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [date, setDate] = useState(() => colomboDay());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useQuery({
    queryKey: ['report-daily', date],
    queryFn: () => api<DailyReport>(`/reports/daily?date=${date}`),
  });
  const pdf = async () => {
    if (!q.data) return;
    downloadBlob(await dailyRevenuePdf(q.data), `Revenue_Report_${date}.pdf`);
  };
  const csv = async () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    try {
      downloadBlob(
        await apiBlob(`/reports/orders.csv?${params}`),
        `Completed_Orders_${from || 'all'}_${to || 'to-date'}.csv`,
      );
    } catch (e) {
      toast.error(t(errorKey(e)));
    }
  };
  const r = q.data;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('nav.reports')}</h1>
      <section
        aria-labelledby="daily"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <h2 id="daily" className="font-display text-lg font-bold">
          {t('legacy.dailyRevenuePdf')}
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t('payroll.date')}
            <Input
              type="date"
              value={date}
              max={colomboDay()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-48"
            />
          </label>
          <Button variant="outline" onClick={() => setDate(colomboDay())}>
            {t('reports.today')}
          </Button>
          <Button variant="outline" onClick={() => setDate(colomboDay(-1))}>
            {t('reports.previousDay')}
          </Button>
          <Button
            disabled={!r}
            onClick={() => void pdf().catch(() => toast.error(t('errors.generic')))}
          >
            <FileDown aria-hidden /> PDF
          </Button>
        </div>
        {q.isLoading ? (
          <Skeleton className="h-24" />
        ) : q.isError ? (
          <EmptyState tone="danger" title={t(errorKey(q.error))} />
        ) : (
          r && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t('reports.vehicles')}
                value={`${r.totals.vehicles} / ${r.target}`}
                progress={(r.totals.vehicles / Math.max(1, r.target)) * 100}
              />
              <StatCard label={t('reports.cash')} value={formatLKR(r.totals.cashCents)} />
              <StatCard label={t('reports.card')} value={formatLKR(r.totals.cardCents)} />
              <StatCard label={t('reports.total')} value={formatLKR(r.totals.grandTotalCents)} />
            </div>
          )
        )}
      </section>
      {can('report.export') && (
        <section
          aria-labelledby="csv"
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <h2 id="csv" className="font-display text-lg font-bold">
            {t('legacy.completedOrdersCsv')}
          </h2>
          <p className="text-sm text-fg-muted">{t('reports.csvHint')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t('leave.start')}
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-48"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t('leave.end')}
              <Input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="w-48"
              />
            </label>
            <Button variant="outline" onClick={() => void csv()}>
              <FileSpreadsheet aria-hidden /> CSV
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

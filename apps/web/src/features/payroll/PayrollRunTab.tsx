import { formatLKR, type PayrollRun, type PayslipLine } from '@stopwash/shared';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
} from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Lock } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '@/features/receipt/receiptPdf';
import { useConfig } from '@/features/settings/useConfig';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';
import { periodLabel, salarySlipPdf } from './salarySlipPdf';

interface Preview {
  period: string;
  lines: PayslipLine[];
  totals: PayrollRun['totals'];
}

export function currentPeriod(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
}

function Breakdown({ line, onClose }: { line: PayslipLine; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('payroll.breakdownTitle', { name: line.name })}
    >
      {!line.incentiveBreakdown.length ? (
        <p className="text-sm text-fg-muted">{t('payroll.noBonus')}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('payroll.date')}</TH>
              <TH className="text-right">{t('payroll.vehicles')}</TH>
              <TH>{t('payroll.tier')}</TH>
              <TH className="text-right">{t('payroll.bonus')}</TH>
            </TR>
          </THead>
          <TBody>
            {line.incentiveBreakdown.map((d) => (
              <TR key={d.date}>
                <TD>{d.date}</TD>
                <TD className="tabular text-right">{d.count}</TD>
                <TD>
                  {d.tierTarget}+{d.multiplier < 1 && ` × ${d.multiplier}`}
                </TD>
                <TD className="tabular text-right">{formatLKR(d.bonusCents)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Dialog>
  );
}

export function PayrollRunTab() {
  const { t } = useTranslation();
  const { can } = useSession();
  const qc = useQueryClient();
  const config = useConfig();
  const [period, setPeriod] = useState(currentPeriod);
  const [open, setOpen] = useState<PayslipLine | null>(null);
  const runs = useQuery({
    queryKey: ['payroll-runs', period],
    queryFn: () => api<{ items: PayrollRun[] }>(`/payroll/runs?period=${period}`),
  });
  const latest = runs.data?.items[0];
  const preview = useQuery({
    queryKey: ['payroll-preview', period],
    enabled: !!runs.data && !latest,
    queryFn: () => api<Preview>(`/payroll/preview?period=${period}`),
  });
  const data = latest ?? preview.data;
  const finalize = useMutation({
    mutationFn: (kind: 'REGULAR' | 'SUPPLEMENTARY') =>
      api<PayrollRun>('/payroll/runs', {
        idempotencyKey: crypto.randomUUID(),
        body: { period, kind },
      }),
    onSuccess: () => {
      toast.success(t('payroll.finalized', { period: periodLabel(period) }));
      void qc.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const slip = async (line: PayslipLine) => {
    if (!config.data) return;
    downloadBlob(
      await salarySlipPdf(line, period, config.data.settings.business, latest ? 'FINAL' : 'DRAFT'),
      `SalarySlip_${line.name.replace(/\s+/g, '_')}_${period}.pdf`,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('payroll.period')}
          <Input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="w-48"
          />
        </label>
        {latest ? (
          <Badge tone="success">
            <Lock aria-hidden />{' '}
            {t(latest.kind === 'REGULAR' ? 'payroll.final' : 'payroll.supplementary')}
          </Badge>
        ) : (
          <Badge tone="warning">{t('payroll.draft')}</Badge>
        )}
        {can('payroll.finalize') &&
          (latest ? (
            <Button
              variant="outline"
              loading={finalize.isPending}
              onClick={() =>
                window.confirm(t('payroll.suppConfirm')) && finalize.mutate('SUPPLEMENTARY')
              }
            >
              {t('payroll.runSupplementary')}
            </Button>
          ) : (
            <Button
              loading={finalize.isPending}
              disabled={!preview.data?.lines.length}
              onClick={() =>
                window.confirm(t('payroll.finalizeConfirm', { period: periodLabel(period) })) &&
                finalize.mutate('REGULAR')
              }
            >
              {t('payroll.finalize')}
            </Button>
          ))}
      </div>
      {runs.isLoading || preview.isLoading ? (
        <Skeleton className="h-64" />
      ) : !data?.lines.length ? (
        <EmptyState title={t('payroll.none')} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('staff.name')}</TH>
              <TH className="text-right">{t('payroll.base')}</TH>
              <TH className="text-right">{t('payroll.bonus')}</TH>
              <TH className="text-right">{t('payroll.additions')}</TH>
              <TH className="text-right">{t('payroll.deductions')}</TH>
              <TH className="text-right">{t('payroll.net')}</TH>
              <TH>
                <span className="sr-only">{t('payroll.slip')}</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {data.lines.map((l) => (
              <TR key={l.employeeId}>
                <TD className="font-semibold">
                  {l.name}
                  <p className="text-xs font-normal text-fg-muted">
                    {l.code} · {l.jobTitle}
                  </p>
                </TD>
                <TD className="tabular text-right">{formatLKR(l.baseCents)}</TD>
                <TD className="tabular text-right">
                  <Button variant="link" className="h-auto" onClick={() => setOpen(l)}>
                    {formatLKR(l.incentiveCents)}
                  </Button>
                </TD>
                <TD className="tabular text-right">
                  {formatLKR(l.recurringAdditionCents + l.bonusAdjCents)}
                </TD>
                <TD className="tabular text-right text-danger">
                  −
                  {formatLKR(
                    l.recurringDeductionCents + l.oneOffDeductionCents + l.epfEmployeeCents,
                  )}
                </TD>
                <TD className="tabular text-right font-bold">{formatLKR(l.netCents)}</TD>
                <TD>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('payroll.slipFor', { name: l.name })}
                    onClick={() => void slip(l)}
                  >
                    <FileDown aria-hidden />
                  </Button>
                </TD>
              </TR>
            ))}
            <TR className="bg-surface-2 font-bold">
              <TD>{t('common.total')}</TD>
              <TD colSpan={4} />
              <TD className="tabular text-right">{formatLKR(data.totals.netCents)}</TD>
              <TD />
            </TR>
          </TBody>
        </Table>
      )}
      {open && <Breakdown line={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

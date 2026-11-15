import { formatLKR, tryParseRupees, type Shift, type ShiftClose } from '@stopwash/shared';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  Pagination,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  toast,
} from '@stopwash/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatColombo } from '@/features/receipt/receipt';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';
import { downloadShiftReport } from './reconciliationPdf';

interface Row {
  shift: Shift;
  close: ShiftClose | null;
  latest: ShiftClose | null;
}
interface Page {
  items: Row[];
  total: number;
  page: number;
  pageCount: number;
}

const STATUS_TONE = {
  OPEN: 'info',
  CLOSED: 'warning',
  QUERIED: 'danger',
  APPROVED: 'success',
} as const;

function AdjustDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const cents = counted.trim() ? tryParseRupees(counted) : undefined;
  const adjust = useMutation({
    mutationFn: () =>
      api<ShiftClose>(`/shifts/${row.shift.id}/adjust`, {
        idempotencyKey: key,
        body: { reason, ...(cents !== undefined && cents !== null ? { countedCents: cents } : {}) },
      }),
    onSuccess: (a) => {
      toast.success(t('history.adjusted', { variance: formatLKR(a.varianceCents) }));
      void qc.invalidateQueries({ queryKey: ['shifts'] });
      onClose();
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('history.adjustTitle')}
      description={t('history.adjustBody')}
      footer={
        <Button
          disabled={reason.trim().length < 3 || cents === null}
          loading={adjust.isPending}
          onClick={() => adjust.mutate()}
        >
          {t('history.adjust')}
        </Button>
      }
    >
      <div className="grid gap-3">
        <Field label={t('history.correctedCount')} hint={t('history.correctedHint')}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              placeholder={
                row.latest ? formatLKR(row.latest.countedCents, { currency: false }) : ''
              }
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('history.reason')} required>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}

export function ShiftHistory() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<Row | null>(null);
  const q = useQuery({
    queryKey: ['shifts', page],
    queryFn: () => api<Page>(`/shifts?page=${page}`),
    placeholderData: keepPreviousData,
  });
  if (q.isLoading) return <Skeleton className="h-48" />;
  if (q.isError) return <EmptyState tone="danger" title={t(errorKey(q.error))} />;
  if (!q.data?.items.length) return <EmptyState title={t('history.none')} />;
  return (
    <section aria-labelledby="shift-history" className="flex flex-col gap-3">
      <h2 id="shift-history" className="font-display text-xl font-bold">
        {t('legacy.viewHistory')}
      </h2>
      <Table>
        <THead>
          <TR>
            <TH>{t('history.opened')}</TH>
            <TH>{t('shift.supervisor')}</TH>
            <TH className="text-right">{t('closeShift.opening')}</TH>
            <TH className="text-right">{t('closeShift.cashSales')}</TH>
            <TH className="text-right">{t('history.card')}</TH>
            <TH className="text-right">{t('closeShift.counted')}</TH>
            <TH className="text-right">{t('closeShift.variance')}</TH>
            <TH>{t('catalog.status')}</TH>
            <TH>
              <span className="sr-only">{t('approvals.actions')}</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {q.data.items.map((row) => {
            const l = row.latest;
            const v = l?.varianceCents ?? null;
            return (
              <TR key={row.shift.id}>
                <TD className="whitespace-nowrap">
                  {formatColombo(row.shift.openedAt)}
                  {row.shift.backdated && (
                    <Badge className="ml-2" tone="info">
                      {t('history.backdated')}
                    </Badge>
                  )}
                </TD>
                <TD>{row.shift.supervisorName}</TD>
                <TD className="tabular text-right">{formatLKR(row.shift.openingCents)}</TD>
                <TD className="tabular text-right">{l ? formatLKR(l.cashSalesCents) : '—'}</TD>
                <TD className="tabular text-right">{l ? formatLKR(l.cardSalesCents) : '—'}</TD>
                <TD className="tabular text-right">{l ? formatLKR(l.countedCents) : '—'}</TD>
                <TD
                  className={
                    v === null
                      ? 'text-right'
                      : v < -1000
                        ? 'tabular text-right font-bold text-danger'
                        : v > 1000
                          ? 'tabular text-right font-bold text-warning'
                          : 'tabular text-right text-success'
                  }
                >
                  {v === null ? '—' : formatLKR(v)}
                  {l?.kind === 'ADJUSTMENT' && (
                    <p className="text-xs font-normal text-fg-muted">{t('history.adjustedTag')}</p>
                  )}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[row.shift.status]}>
                    {t(`approvals.status.${row.shift.status}`)}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('closeShift.reportPdf')}
                      onClick={() =>
                        void downloadShiftReport(row.shift.id).catch(() =>
                          toast.error(t('errors.generic')),
                        )
                      }
                    >
                      <FileDown aria-hidden />
                    </Button>
                    {can('shift.adjust') &&
                      (row.shift.status === 'CLOSED' || row.shift.status === 'QUERIED') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('history.adjust')}
                          onClick={() => setAdjusting(row)}
                        >
                          <SlidersHorizontal aria-hidden />
                        </Button>
                      )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {q.data.pageCount > 1 && (
        <Pagination page={q.data.page} pageCount={q.data.pageCount} onPageChange={setPage} />
      )}
      {adjusting && <AdjustDialog row={adjusting} onClose={() => setAdjusting(null)} />}
    </section>
  );
}

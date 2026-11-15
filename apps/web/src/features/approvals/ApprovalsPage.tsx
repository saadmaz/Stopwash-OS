import { formatLKR, type Shift, type ShiftApproval, type ShiftClose } from '@stopwash/shared';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  SegmentedControl,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  toast,
} from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileDown, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadShiftReport } from '@/features/shift/reconciliationPdf';
import { formatColombo } from '@/features/receipt/receipt';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Row {
  shift: Shift;
  close: ShiftClose | null;
  approvals: ShiftApproval[];
}
interface ApprovalsResponse {
  rows: Row[];
  kpis: {
    pendingCount: number;
    expectedCents: number;
    countedCents: number;
    expensesCents: number;
    varianceCents: number;
  };
}
type Filter = 'PENDING' | 'APPROVED' | 'ALL';

const STATUS_TONE = {
  CLOSED: 'warning',
  QUERIED: 'danger',
  APPROVED: 'success',
  OPEN: 'info',
} as const;

function useDecide() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { shiftId: string; decision: 'APPROVED' | 'QUERIED'; note: string | null }) =>
      api(`/shifts/${v.shiftId}/decision`, {
        idempotencyKey: crypto.randomUUID(),
        body: { decision: v.decision, note: v.note },
      }),
    onSuccess: (_d, v) => {
      toast.success(t(v.decision === 'APPROVED' ? 'approvals.approved' : 'approvals.queried'));
      void qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
}

function QueryDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const decide = useDecide();
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('approvals.queryTitle', { name: row.shift.supervisorName })}
      footer={
        <Button
          disabled={!note.trim()}
          loading={decide.isPending}
          onClick={() =>
            decide.mutate(
              { shiftId: row.shift.id, decision: 'QUERIED', note },
              { onSuccess: onClose },
            )
          }
        >
          {t('approvals.query')}
        </Button>
      }
    >
      <Field label={t('approvals.queryNote')} required>
        {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </Dialog>
  );
}

export function ApprovalsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [querying, setQuerying] = useState<Row | null>(null);
  const decide = useDecide();
  const q = useQuery({
    queryKey: ['approvals', filter],
    queryFn: () => api<ApprovalsResponse>(`/approvals?status=${filter}`),
  });
  const k = q.data?.kpis;

  const variance = (c: number) => (
    <span
      className={
        c === 0 ? 'text-success' : Math.abs(c) > 50_000 ? 'font-bold text-danger' : 'text-warning'
      }
    >
      {formatLKR(c)}
    </span>
  );

  let body;
  if (q.isLoading) body = <Skeleton className="h-64" />;
  else if (q.isError) body = <EmptyState tone="danger" title={t(errorKey(q.error))} />;
  else if (!q.data?.rows.length)
    body = (
      <EmptyState
        icon={<ShieldCheck />}
        title={t(filter === 'PENDING' ? 'approvals.allDone' : 'approvals.none')}
      />
    );
  else
    body = (
      <Table>
        <THead>
          <TR>
            <TH>{t('approvals.closed')}</TH>
            <TH>{t('shift.supervisor')}</TH>
            <TH className="text-right">{t('approvals.sales')}</TH>
            <TH className="text-right">{t('closeShift.expected')}</TH>
            <TH className="text-right">{t('closeShift.counted')}</TH>
            <TH className="text-right">{t('closeShift.variance')}</TH>
            <TH>{t('catalog.status')}</TH>
            <TH>
              <span className="sr-only">{t('approvals.actions')}</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {q.data.rows.map((row) => {
            const c = row.close;
            const pending = row.shift.status === 'CLOSED' || row.shift.status === 'QUERIED';
            const lastNote = row.approvals.at(-1)?.note;
            return (
              <TR key={row.shift.id}>
                <TD className="whitespace-nowrap">
                  {row.shift.closedAt ? formatColombo(row.shift.closedAt) : '—'}
                </TD>
                <TD>
                  {row.shift.supervisorName}
                  <p className="text-xs text-fg-muted">
                    {t('approvals.vehicles', { count: c?.vehicleCount ?? 0 })}
                  </p>
                </TD>
                <TD className="tabular text-right">
                  {c ? formatLKR(c.cashSalesCents + c.cardSalesCents + c.otherSalesCents) : '—'}
                </TD>
                <TD className="tabular text-right">{c ? formatLKR(c.expectedCents) : '—'}</TD>
                <TD className="tabular text-right">{c ? formatLKR(c.countedCents) : '—'}</TD>
                <TD className="tabular text-right">
                  {c ? variance(c.varianceCents) : '—'}
                  {c?.notes && (
                    <p className="max-w-48 truncate text-xs text-fg-muted" title={c.notes}>
                      {c.notes}
                    </p>
                  )}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[row.shift.status]}>
                    {t(`approvals.status.${row.shift.status}`)}
                  </Badge>
                  {lastNote && (
                    <p className="max-w-40 truncate text-xs text-fg-muted" title={lastNote}>
                      {lastNote}
                    </p>
                  )}
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
                    {pending && can('shift.approve') && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('approvals.query')}
                          onClick={() => setQuerying(row)}
                        >
                          <MessageSquareWarning aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          loading={decide.isPending && decide.variables?.shiftId === row.shift.id}
                          onClick={() =>
                            decide.mutate({
                              shiftId: row.shift.id,
                              decision: 'APPROVED',
                              note: null,
                            })
                          }
                        >
                          <Check aria-hidden /> {t('approvals.approve')}
                        </Button>
                      </>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('nav.approvals')}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('approvals.pending')}
          value={k?.pendingCount ?? '—'}
          loading={q.isLoading}
        />
        <StatCard
          label={t('approvals.systemCash')}
          value={k ? formatLKR(k.expectedCents) : '—'}
          loading={q.isLoading}
        />
        <StatCard
          label={t('approvals.actualCash')}
          value={k ? formatLKR(k.countedCents) : '—'}
          loading={q.isLoading}
        />
        <StatCard
          label={t('approvals.expenses')}
          value={k ? formatLKR(k.expensesCents) : '—'}
          loading={q.isLoading}
        />
      </div>
      <SegmentedControl
        aria-label={t('queue.filter')}
        className="max-w-sm"
        value={filter}
        onValueChange={(v) => setFilter(v as Filter)}
        options={[
          { value: 'PENDING', label: t('approvals.pending') },
          { value: 'APPROVED', label: t('approvals.status.APPROVED') },
          { value: 'ALL', label: t('queue.all') },
        ]}
      />
      {body}
      {querying && <QueryDialog row={querying} onClose={() => setQuerying(null)} />}
    </div>
  );
}

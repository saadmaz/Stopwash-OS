import { ATTENDANCE_STATUSES, type Attendance, type AttendanceStatus } from '@stopwash/shared';
import { brand, Button, cn, EmptyState, Input, Skeleton, toast } from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, FileDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '@/features/receipt/receiptPdf';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';

interface RosterRow {
  employeeId: string;
  name: string;
  code: string;
  jobTitle: string;
  status: AttendanceStatus | null;
}

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
/** SWOMS attendance PDF colours. */
const PDF_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: '#16a34a',
  LATE: '#ca8a04',
  HALF_DAY: '#ea580c',
  ABSENT: '#dc2626',
  LEAVE: '#1d5fbf',
};
const CHIP: Record<AttendanceStatus, string> = {
  PRESENT: 'data-[on=true]:bg-success data-[on=true]:text-white',
  LATE: 'data-[on=true]:bg-warning data-[on=true]:text-white',
  HALF_DAY: 'data-[on=true]:bg-warning-fg data-[on=true]:text-white',
  ABSENT: 'data-[on=true]:bg-danger data-[on=true]:text-white',
  LEAVE: 'data-[on=true]:bg-info data-[on=true]:text-white',
};

export async function attendancePdf(
  rows: Attendance[],
  names: Map<string, string>,
  from: string,
  to: string,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(brand.navy).rect(0, 0, 210, 24, 'F');
  doc
    .setTextColor('#FFFFFF')
    .setFont('helvetica', 'bold')
    .setFontSize(14)
    .text('Attendance Report', 15, 15);
  doc
    .setFontSize(9)
    .setFont('helvetica', 'normal')
    .text(`${from} to ${to}`, 195, 15, { align: 'right' });
  let y = 34;
  doc
    .setTextColor('#050A12')
    .setFont('helvetica', 'bold')
    .setFontSize(9)
    .text('Date', 15, y)
    .text('Employee', 50, y)
    .text('Status', 150, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  for (const r of rows) {
    if (y > 282) {
      doc.addPage();
      y = 20;
    }
    doc
      .setTextColor('#050A12')
      .text(r.date, 15, y)
      .text(names.get(r.employeeId) ?? r.employeeId, 50, y);
    doc
      .setTextColor(PDF_COLOR[r.status])
      .setFont('helvetica', 'bold')
      .text(r.status.replace('_', '-'), 150, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
  }
  return doc.output('blob');
}

export function AttendancePage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const qc = useQueryClient();
  const [date, setDate] = useState(today);
  const [edits, setMarks] = useState<Record<string, AttendanceStatus | null>>({});
  const q = useQuery({
    queryKey: ['attendance', date],
    queryFn: () => api<{ items: RosterRow[] }>(`/attendance?date=${date}`),
  });
  // Server statuses with this session's edits on top (no state syncing in effects).
  const marks: Record<string, AttendanceStatus | null> = {
    ...Object.fromEntries((q.data?.items ?? []).map((r) => [r.employeeId, r.status])),
    ...edits,
  };
  const save = useMutation({
    mutationFn: () =>
      api<{ saved: number }>('/attendance', {
        method: 'PUT',
        idempotencyKey: crypto.randomUUID(),
        body: {
          date,
          entries: Object.entries(marks)
            .filter(([, s]) => s)
            .map(([employeeId, status]) => ({ employeeId, status })),
        },
      }),
    onSuccess: (r) => {
      toast.success(t('attendance.saved', { count: r.saved }));
      void qc.invalidateQueries({ queryKey: ['attendance', date] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const report = async () => {
    const from = `${date.slice(0, 7)}-01`;
    const r = await api<{ items: Attendance[] }>(`/attendance/report?from=${from}&to=${date}`);
    const names = new Map((q.data?.items ?? []).map((x) => [x.employeeId, x.name]));
    downloadBlob(await attendancePdf(r.items, names, from, date), `Attendance_${from}_${date}.pdf`);
  };
  const write = can('attendance.write');
  const rows = q.data?.items ?? [];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('legacy.attendanceChecker')}</h1>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('payroll.date')}
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              if (!e.target.value) return;
              setDate(e.target.value);
              setMarks({});
            }}
            className="w-48"
          />
        </label>
        {write && (
          <Button
            variant="outline"
            onClick={() =>
              setMarks(
                Object.fromEntries(
                  rows.map((r) => [
                    r.employeeId,
                    marks[r.employeeId] === 'LEAVE' ? 'LEAVE' : 'PRESENT',
                  ]),
                ),
              )
            }
          >
            <CheckCheck aria-hidden /> {t('legacy.allPresent')}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => void report().catch(() => toast.error(t('errors.generic')))}
        >
          <FileDown aria-hidden /> {t('attendance.monthPdf')}
        </Button>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-48" />
      ) : !rows.length ? (
        <EmptyState title={t('staff.none')} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((r) => (
            <li key={r.employeeId} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-40 flex-1">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-fg-muted">
                  {r.code} · {r.jobTitle}
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label={t('attendance.statusFor', { name: r.name })}
                className="flex flex-wrap gap-1"
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={marks[r.employeeId] === s}
                    data-on={marks[r.employeeId] === s}
                    disabled={!write}
                    onClick={() => setMarks((m) => ({ ...m, [r.employeeId]: s }))}
                    className={cn(
                      'h-11 rounded-md bg-surface-2 px-3 text-sm font-semibold text-fg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60',
                      CHIP[s],
                    )}
                  >
                    {t(`attendance.status.${s}`)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {write && rows.length > 0 && (
        <div>
          <Button size="lg" loading={save.isPending} onClick={() => save.mutate()}>
            {t('common.save')}
          </Button>
        </div>
      )}
    </div>
  );
}

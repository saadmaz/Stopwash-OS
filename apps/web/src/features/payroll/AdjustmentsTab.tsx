import {
  DEDUCTION_CATEGORIES,
  formatLKR,
  tryParseRupees,
  type Employee,
  type PayrollAdjustment,
} from '@stopwash/shared';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  Select,
  Skeleton,
  toast,
} from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';
import { currentPeriod } from './PayrollRunTab';

type Kind = 'DEDUCTION' | 'BONUS';
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());

export function AdjustmentsTab() {
  const { t } = useTranslation();
  const { can } = useSession();
  const qc = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod);
  const [employeeId, setEmployeeId] = useState('');
  const [kind, setKind] = useState<Kind>('DEDUCTION');
  const [category, setCategory] = useState<string>('ADVANCE');
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const employees = useQuery({
    queryKey: ['employees'],
    queryFn: () => api<{ items: Employee[] }>('/employees'),
  });
  const list = useQuery({
    queryKey: ['payroll-adjustments', period],
    queryFn: () => api<{ items: PayrollAdjustment[] }>(`/payroll-adjustments?period=${period}`),
  });
  const names = new Map((employees.data?.items ?? []).map((e) => [e.id, e.name]));
  const cents = tryParseRupees(amount);
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['payroll-adjustments'] });
    void qc.invalidateQueries({ queryKey: ['payroll-preview'] });
  };
  const add = useMutation({
    mutationFn: () =>
      api('/payroll-adjustments', {
        idempotencyKey: crypto.randomUUID(),
        body: {
          employeeId,
          date,
          kind,
          category: kind === 'BONUS' ? category || 'Adjustment' : category,
          amountCents: cents,
          reason,
        },
      }),
    onSuccess: () => {
      toast.success(t('staff.saved'));
      setAmount('');
      setReason('');
      done();
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const reverse = useMutation({
    mutationFn: (id: string) =>
      api(`/payroll-adjustments/${id}/reverse`, {
        idempotencyKey: crypto.randomUUID(),
        body: { reason: 'Reversed from payroll screen' },
      }),
    onSuccess: done,
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const valid =
    employeeId && cents !== null && cents !== 0 && (kind === 'BONUS' || cents > 0) && reason.trim();
  const items = list.data?.items ?? [];
  const reversed = new Set(items.map((i) => i.reversesId).filter(Boolean));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[24rem_1fr]">
      {can('payroll.adjust') && (
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) add.mutate();
          }}
        >
          <SegmentedControl
            aria-label={t('adjustments.kind')}
            value={kind}
            onValueChange={(v) => {
              setKind(v as Kind);
              setCategory(v === 'DEDUCTION' ? 'ADVANCE' : '');
            }}
            options={[
              { value: 'DEDUCTION', label: t('adjustments.deduction') },
              { value: 'BONUS', label: t('adjustments.bonus') },
            ]}
          />
          <Field label={t('adjustments.employee')} required>
            {(p) => (
              <Select
                {...p}
                value={employeeId}
                onValueChange={setEmployeeId}
                placeholder={t('adjustments.chooseEmployee')}
                options={(employees.data?.items ?? []).map((e) => ({
                  value: e.id,
                  label: `${e.code} · ${e.name}`,
                }))}
              />
            )}
          </Field>
          {kind === 'DEDUCTION' ? (
            <Field label={t('adjustments.category')}>
              {(p) => (
                <Select
                  {...p}
                  value={category}
                  onValueChange={setCategory}
                  options={DEDUCTION_CATEGORIES.map((c) => ({
                    value: c,
                    label: t(`adjustments.categories.${c}`),
                  }))}
                />
              )}
            </Field>
          ) : (
            <Field label={t('adjustments.label')} hint={t('adjustments.labelHint')}>
              {(p) => (
                <Input {...p} value={category} onChange={(e) => setCategory(e.target.value)} />
              )}
            </Field>
          )}
          <Field label={t('payroll.date')}>
            {(p) => (
              <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            )}
          </Field>
          <Field
            label={t('cash.amount')}
            hint={kind === 'BONUS' ? t('adjustments.bonusHint') : undefined}
            required
          >
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </Field>
          <Field label={t('history.reason')} required>
            {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <Button type="submit" disabled={!valid} loading={add.isPending}>
            {t('common.add')}
          </Button>
        </form>
      )}
      <section className="flex flex-col gap-3">
        <label className="flex w-48 flex-col gap-1.5 text-sm font-medium">
          {t('payroll.period')}
          <Input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
          />
        </label>
        {list.isLoading ? (
          <Skeleton className="h-32" />
        ) : !items.length ? (
          <EmptyState title={t('adjustments.none')} />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {items.map((a) => (
              <li key={a.id} className="flex items-center gap-3 p-3">
                <span className="w-24 text-xs text-fg-muted">{a.date}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{names.get(a.employeeId) ?? a.employeeId}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {a.category} · {a.reason}
                  </p>
                </div>
                <Badge tone={a.kind === 'DEDUCTION' ? 'warning' : 'success'}>
                  {t(a.kind === 'DEDUCTION' ? 'adjustments.deduction' : 'adjustments.bonus')}
                </Badge>
                <span className="tabular w-28 text-right font-semibold">
                  {formatLKR(a.amountCents)}
                </span>
                {can('payroll.adjust') && !a.reversesId && !reversed.has(a.id) ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('cash.reverse')}
                    onClick={() => reverse.mutate(a.id)}
                  >
                    <Undo2 aria-hidden />
                  </Button>
                ) : (
                  <span className="w-11" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

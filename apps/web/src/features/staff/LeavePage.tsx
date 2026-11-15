import type { Employee, Leave } from '@stopwash/shared';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  toast,
} from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';

const TONE = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
} as const;

export function LeavePage() {
  const { t } = useTranslation();
  const { user, can } = useSession();
  const qc = useQueryClient();
  const admin = can('leave.read.all');
  const [employeeId, setEmployeeId] = useState(user?.employeeId ?? '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const leaves = useQuery({
    queryKey: ['leaves'],
    queryFn: () => api<{ items: Leave[] }>('/leaves'),
  });
  const employees = useQuery({
    queryKey: ['employees'],
    enabled: admin,
    queryFn: () => api<{ items: Employee[] }>('/employees'),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['leaves'] });
  const submit = useMutation({
    mutationFn: () =>
      api('/leaves', {
        idempotencyKey: crypto.randomUUID(),
        body: { employeeId, startDate: start, endDate: end, reason },
      }),
    onSuccess: () => {
      toast.success(t('leave.sent'));
      setReason('');
      refresh();
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'APPROVED' | 'REJECTED' | 'CANCEL' }) =>
      v.action === 'CANCEL'
        ? api(`/leaves/${v.id}/cancel`, { idempotencyKey: crypto.randomUUID(), body: {} })
        : api(`/leaves/${v.id}/decision`, {
            idempotencyKey: crypto.randomUUID(),
            body: { decision: v.action },
          }),
    onSuccess: refresh,
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const valid = employeeId && start && end && end >= start && reason.trim();
  const items = leaves.data?.items ?? [];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('legacy.leaveRequests')}</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <form
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) submit.mutate();
          }}
        >
          <h2 className="font-display text-lg font-bold">{t('leave.request')}</h2>
          {admin && (
            <Field label={t('adjustments.employee')}>
              {(p) => (
                <Select
                  {...p}
                  value={employeeId}
                  onValueChange={setEmployeeId}
                  placeholder={t('adjustments.chooseEmployee')}
                  options={(employees.data?.items ?? []).map((e) => ({
                    value: e.id,
                    label: e.name,
                  }))}
                />
              )}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('leave.start')} required>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              )}
            </Field>
            <Field
              label={t('leave.end')}
              required
              error={start && end && end < start ? t('leave.endBeforeStart') : undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={end}
                  min={start}
                  onChange={(e) => setEnd(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label={t('leave.reason')} hint={t('leave.reasonHint')} required>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" disabled={!valid} loading={submit.isPending}>
            {t('leave.submit')}
          </Button>
        </form>
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">
            {admin ? t('leave.all') : t('leave.mine')}
          </h2>
          {leaves.isLoading ? (
            <Skeleton className="h-32" />
          ) : !items.length ? (
            <EmptyState title={t('leave.none')} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {items.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.employeeName}</p>
                    <p className="text-sm text-fg-muted">
                      {l.startDate} → {l.endDate} · {t('leave.days', { count: l.days })}
                    </p>
                    {admin && <p className="truncate text-xs text-fg-subtle">{l.reason}</p>}
                  </div>
                  <Badge tone={TONE[l.status]}>{t(`leave.status.${l.status}`)}</Badge>
                  {l.status === 'PENDING' &&
                    can('leave.approve') &&
                    l.employeeId !== user?.employeeId && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={t('leave.approve', { name: l.employeeName })}
                          onClick={() => act.mutate({ id: l.id, action: 'APPROVED' })}
                        >
                          <Check aria-hidden />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('leave.reject', { name: l.employeeName })}
                          onClick={() => act.mutate({ id: l.id, action: 'REJECTED' })}
                        >
                          <X aria-hidden />
                        </Button>
                      </>
                    )}
                  {l.status === 'PENDING' && l.employeeId === user?.employeeId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act.mutate({ id: l.id, action: 'CANCEL' })}
                    >
                      {t('common.cancel')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

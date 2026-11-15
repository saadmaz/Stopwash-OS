import { formatLKR, type Employee } from '@stopwash/shared';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
} from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, UserX, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';
import { EmployeeDialog, type RuleOption } from './EmployeeDialog';

const thisPeriod = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());

function useEmployeeAction() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { url: string; method?: 'POST' | 'PATCH'; body: unknown }) =>
      api(v.url, { method: v.method ?? 'POST', idempotencyKey: crypto.randomUUID(), body: v.body }),
    onSuccess: () => {
      toast.success(t('staff.saved'));
      void qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
}

function PinDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const action = useEmployeeAction();
  return (
    <Dialog
      open
      size="sm"
      onOpenChange={(o) => !o && onClose()}
      title={t('staff.resetPinTitle', { name: employee.name })}
      footer={
        <Button
          disabled={!/^\d{4,6}$/.test(pin)}
          loading={action.isPending}
          onClick={() =>
            action.mutate(
              { url: `/employees/${employee.id}/pin`, body: { pin } },
              { onSuccess: onClose },
            )
          }
        >
          {t('common.save')}
        </Button>
      }
    >
      <Field label={t('staff.pin')} hint={t('staff.pinHint')}>
        {(p) => (
          <Input
            {...p}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        )}
      </Field>
    </Dialog>
  );
}

export function StaffPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [pinFor, setPinFor] = useState<Employee | null>(null);
  const action = useEmployeeAction();
  const q = useQuery({
    queryKey: ['employees'],
    queryFn: () => api<{ items: Employee[] }>('/employees'),
  });
  const rules = useQuery({
    queryKey: ['incentive-rules'],
    enabled: can('payroll.read'),
    queryFn: () => api<{ items: RuleOption[] }>('/incentive-rules').catch(() => ({ items: [] })),
  });
  const period = thisPeriod();
  const write = can('employee.write');

  let body;
  if (q.isLoading) body = <Skeleton className="h-64" />;
  else if (q.isError) body = <EmptyState tone="danger" title={t(errorKey(q.error))} />;
  else if (!q.data?.items.length) body = <EmptyState icon={<Users />} title={t('staff.none')} />;
  else
    body = (
      <Table>
        <THead>
          <TR>
            <TH>{t('staff.code')}</TH>
            <TH>{t('staff.name')}</TH>
            <TH>{t('staff.jobTitle')}</TH>
            <TH>{t('staff.access')}</TH>
            <TH className="text-right">{t('staff.salary')}</TH>
            <TH>{t('staff.skipThisMonth')}</TH>
            <TH>
              <span className="sr-only">{t('approvals.actions')}</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {q.data.items.map((e) => {
            const exempt = e.exemptMonths.includes(period);
            return (
              <TR key={e.id}>
                <TD>
                  <code className="text-xs">{e.code}</code>
                </TD>
                <TD className="font-semibold">
                  {e.name}
                  <p className="text-xs font-normal text-fg-muted">{e.phone}</p>
                </TD>
                <TD>
                  {e.jobTitle}
                  {e.canOpenShift && (
                    <Badge className="ml-2" tone="info">
                      {t('staff.shiftLead')}
                    </Badge>
                  )}
                </TD>
                <TD>
                  {e.systemRole ? (
                    t(`role.${e.systemRole}`)
                  ) : (
                    <span className="text-fg-muted">{t('staff.noAccess')}</span>
                  )}
                  {e.systemRole && !e.hasPin && (
                    <Badge className="ml-2" tone="warning">
                      {t('staff.noPin')}
                    </Badge>
                  )}
                </TD>
                <TD className="tabular text-right">
                  {formatLKR(e.baseSalaryCents)}
                  {e.recurringAdditionCents > 0 && (
                    <p className="text-xs text-success">+{formatLKR(e.recurringAdditionCents)}</p>
                  )}
                  {e.recurringDeductionCents > 0 && (
                    <p className="text-xs text-danger">−{formatLKR(e.recurringDeductionCents)}</p>
                  )}
                </TD>
                <TD>
                  <Switch
                    checked={exempt}
                    disabled={!write}
                    aria-label={t('staff.skipThisMonthFor', { name: e.name })}
                    onCheckedChange={(v) =>
                      action.mutate({
                        url: `/employees/${e.id}/exempt`,
                        body: { period, exempt: v },
                      })
                    }
                  />
                </TD>
                <TD>
                  {write && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t('common.edit')} ${e.name}`}
                        onClick={() => setEditing(e)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      {can('employee.pin.reset') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('staff.resetPin')}
                          onClick={() => setPinFor(e)}
                        >
                          <KeyRound aria-hidden />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('staff.deactivate', { name: e.name })}
                        onClick={() =>
                          window.confirm(t('staff.deactivateConfirm', { name: e.name })) &&
                          action.mutate({
                            url: `/employees/${e.id}`,
                            method: 'PATCH',
                            body: { active: false },
                          })
                        }
                      >
                        <UserX aria-hidden />
                      </Button>
                    </div>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{t('nav.staff')}</h1>
        {write && (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden /> {t('staff.add')}
          </Button>
        )}
      </div>
      {body}
      {editing && (
        <EmployeeDialog
          employee={editing === 'new' ? null : editing}
          rules={rules.data?.items ?? []}
          onClose={() => setEditing(null)}
        />
      )}
      {pinFor && <PinDialog employee={pinFor} onClose={() => setPinFor(null)} />}
    </div>
  );
}

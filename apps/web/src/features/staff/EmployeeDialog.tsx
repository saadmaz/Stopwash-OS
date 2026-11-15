import { formatLKR, toRupeesString, tryParseRupees, type Employee } from '@stopwash/shared';
import { Button, Checkbox, Dialog, Field, Input, Select, toast } from '@stopwash/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';

const JOB_TITLES = ['Washer', 'Supervisor', 'Trainee', 'Manager', 'Cashier', 'Accounts'];

export interface RuleOption {
  id: string;
  name: string;
}

export function EmployeeDialog({
  employee,
  rules = [],
  onClose,
}: {
  employee: Employee | null;
  rules?: RuleOption[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const [f, setF] = useState({
    code: employee?.code ?? '',
    name: employee?.name ?? '',
    phone: employee?.phone ?? '',
    jobTitle: employee?.jobTitle ?? 'Washer',
    systemRole: employee?.systemRole ?? 'none',
    salary: employee ? toRupeesString(employee.baseSalaryCents) : '',
    deduction: employee ? toRupeesString(employee.recurringDeductionCents) : '0',
    addition: employee ? toRupeesString(employee.recurringAdditionCents) : '0',
    canOpenShift: employee?.canOpenShift ?? false,
    incentiveRuleId: employee?.incentiveRuleId ?? 'none',
    pin: '',
  });
  const [key] = useState(() => crypto.randomUUID());
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const money = (v: string) => tryParseRupees(v);
  const valid =
    /^[A-Z]{2}\d{3,5}$/.test(f.code) &&
    f.name.trim() &&
    f.phone.trim() &&
    (money(f.salary) ?? -1) >= 0 &&
    (money(f.deduction) ?? -1) >= 0 &&
    (money(f.addition) ?? -1) >= 0 &&
    (!f.pin || /^\d{4,6}$/.test(f.pin));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        code: f.code,
        name: f.name.trim(),
        phone: f.phone.trim(),
        jobTitle: f.jobTitle,
        systemRole: f.systemRole === 'none' ? null : f.systemRole,
        locationIds: employee?.locationIds ?? user?.locationIds ?? [],
        baseSalaryCents: money(f.salary)!,
        recurringDeductionCents: money(f.deduction)!,
        recurringAdditionCents: money(f.addition)!,
        incentiveRuleId: f.incentiveRuleId === 'none' ? null : f.incentiveRuleId,
        canOpenShift: f.canOpenShift,
      };
      return employee
        ? api<Employee>(`/employees/${employee.id}`, { method: 'PATCH', idempotencyKey: key, body })
        : api<Employee>('/employees', {
            idempotencyKey: key,
            body: { ...body, pin: f.pin || null },
          });
    },
    onSuccess: () => {
      toast.success(t('staff.saved'));
      void qc.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const roles = [
    'none',
    'cashier',
    'accounts',
    ...(user?.role === 'owner' ? ['manager', 'owner'] : []),
  ];
  const lkr = <span className="text-xs font-semibold">LKR</span>;
  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={employee ? t('staff.edit') : t('legacy.manageEmployees')}
      footer={
        <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('staff.code')} hint="SW001" required>
          {(p) => (
            <Input
              {...p}
              value={f.code}
              onChange={(e) => set('code')(e.target.value.toUpperCase())}
            />
          )}
        </Field>
        <Field label={t('staff.name')} required>
          {(p) => <Input {...p} value={f.name} onChange={(e) => set('name')(e.target.value)} />}
        </Field>
        <Field label={t('pos.phone')} required>
          {(p) => (
            <Input
              {...p}
              inputMode="tel"
              value={f.phone}
              onChange={(e) => set('phone')(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('staff.jobTitle')}>
          {(p) => (
            <Select
              {...p}
              value={f.jobTitle}
              onValueChange={set('jobTitle')}
              options={JOB_TITLES.map((j) => ({ value: j, label: j }))}
            />
          )}
        </Field>
        <Field label={t('staff.access')} hint={t('staff.accessHint')}>
          {(p) => (
            <Select
              {...p}
              value={f.systemRole}
              onValueChange={set('systemRole')}
              options={roles.map((r) => ({
                value: r,
                label: r === 'none' ? t('staff.noAccess') : t(`role.${r}`),
              }))}
            />
          )}
        </Field>
        <Field label={t('staff.salary')} required>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              leading={lkr}
              value={f.salary}
              onChange={(e) => set('salary')(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('staff.recurringAddition')}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              leading={lkr}
              value={f.addition}
              onChange={(e) => set('addition')(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('staff.recurringDeduction')}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              leading={lkr}
              value={f.deduction}
              onChange={(e) => set('deduction')(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('legacy.incentiveRules')}>
          {(p) => (
            <Select
              {...p}
              value={f.incentiveRuleId}
              onValueChange={set('incentiveRuleId')}
              options={[
                { value: 'none', label: t('staff.noRule') },
                ...rules.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          )}
        </Field>
        {!employee && (
          <Field label={t('staff.pin')} hint={t('staff.pinHint')}>
            {(p) => (
              <Input
                {...p}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={f.pin}
                onChange={(e) => set('pin')(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
        )}
        <span className="flex items-center gap-2 sm:col-span-2">
          <Checkbox
            id="emp-open"
            checked={f.canOpenShift}
            onCheckedChange={(v) => set('canOpenShift')(v === true)}
          />
          <label htmlFor="emp-open" className="text-sm">
            {t('staff.canOpenShift')}
          </label>
        </span>
        {money(f.salary) !== null && (
          <p className="text-sm text-fg-muted sm:col-span-2">
            {t('staff.basicNet', {
              amount: formatLKR(
                (money(f.salary) ?? 0) + (money(f.addition) ?? 0) - (money(f.deduction) ?? 0),
              ),
            })}
          </p>
        )}
      </div>
    </Dialog>
  );
}

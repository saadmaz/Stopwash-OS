import { formatLKR, tryParseRupees, type CashMovement } from '@stopwash/shared';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  SegmentedControl,
  Select,
  Skeleton,
  Textarea,
  toast,
} from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Undo2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { isManager, useDeviceStaff } from '@/features/auth/useDeviceStaff';
import { useConfig } from '@/features/settings/useConfig';
import { useCurrentShift } from '@/features/shift/useShift';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';

type Kind = 'EXPENSE' | 'DEPOSIT';
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
  });

function useCashList(enabled: boolean) {
  return useQuery({
    queryKey: ['cash'],
    enabled,
    queryFn: () => api<{ items: CashMovement[] }>('/cash-movements'),
  });
}

function CashForm({ approvalAbove }: { approvalAbove: number }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const config = useConfig();
  const [type, setType] = useState<Kind>('EXPENSE');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [description, setDescription] = useState('');
  const [approverId, setApproverId] = useState('');
  const [pin, setPin] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const cents = tryParseRupees(amount) ?? 0;
  const needsApproval = cents > approvalAbove;
  const staff = useDeviceStaff(needsApproval);
  const categories = (config.data?.cashCategories ?? []).filter((c) => c.type === type);
  const save = useMutation({
    mutationFn: () =>
      api<CashMovement>('/cash-movements', {
        idempotencyKey: key,
        body: {
          type,
          categoryId,
          amountCents: cents,
          paidTo,
          description,
          override: needsApproval ? { employeeId: approverId, pin } : null,
        },
      }),
    onSuccess: () => {
      toast.success(t('cash.saved'));
      void qc.invalidateQueries({ queryKey: ['cash'] });
      setAmount('');
      setPaidTo('');
      setDescription('');
      setPin('');
      setKey(crypto.randomUUID());
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const ready =
    categoryId && cents > 0 && paidTo.trim() && (!needsApproval || (approverId && pin.length >= 4));
  const lkr = <span className="text-xs font-semibold">LKR</span>;
  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) save.mutate();
      }}
    >
      <SegmentedControl
        aria-label={t('cashCategories.type')}
        size="lg"
        value={type}
        onValueChange={(v) => {
          setType(v as Kind);
          setCategoryId('');
        }}
        options={[
          { value: 'EXPENSE', label: t('cash.expense') },
          { value: 'DEPOSIT', label: t('cash.deposit') },
        ]}
      />
      <Field label={t('cash.category')} required>
        {(p) => (
          <Select
            {...p}
            value={categoryId}
            onValueChange={setCategoryId}
            placeholder={t('cash.chooseCategory')}
            options={categories.map((c) => ({
              value: c.id,
              label: `${c.code} · ${(c.name as Record<string, string | undefined>)[i18n.language] || c.name.en}`,
            }))}
          />
        )}
      </Field>
      <Field label={t('cash.amount')} required>
        {(p) => (
          <Input
            {...p}
            inputSize="lg"
            inputMode="decimal"
            leading={lkr}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
      </Field>
      <Field label={t(type === 'EXPENSE' ? 'cash.paidTo' : 'cash.depositedBy')} required>
        {(p) => <Input {...p} value={paidTo} onChange={(e) => setPaidTo(e.target.value)} />}
      </Field>
      <Field label={t('cash.description')}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>
      {needsApproval && (
        <div className="grid gap-3 rounded-md bg-warning-subtle p-3 sm:grid-cols-2">
          <p className="text-sm font-medium text-warning-fg sm:col-span-2">
            {t('cash.needsApproval', { amount: formatLKR(approvalAbove) })}
          </p>
          <Field label={t('checkout.approver')}>
            {(p) => (
              <Select
                {...p}
                value={approverId}
                onValueChange={setApproverId}
                placeholder={t('checkout.chooseApprover')}
                options={(staff.data ?? [])
                  .filter(isManager)
                  .map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
          </Field>
          <Field label={t('checkout.approverPin')}>
            {(p) => (
              <Input
                {...p}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
            )}
          </Field>
        </div>
      )}
      <Button type="submit" size="lg" disabled={!ready} loading={save.isPending}>
        {t('cash.save')}
      </Button>
    </form>
  );
}

function ReverseButton({ m }: { m: CashMovement }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const reverse = useMutation({
    mutationFn: () =>
      api(`/cash-movements/${m.id}/reverse`, { idempotencyKey: key, body: { reason } }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['cash'] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('cash.reverseTitle', { amount: formatLKR(m.amountCents) })}
      description={t('cash.reverseBody')}
      trigger={
        <Button variant="ghost" size="icon" aria-label={t('cash.reverse')}>
          <Undo2 aria-hidden />
        </Button>
      }
      footer={
        <Button
          variant="danger"
          disabled={!reason.trim()}
          loading={reverse.isPending}
          onClick={() => reverse.mutate()}
        >
          {t('cash.reverse')}
        </Button>
      }
    >
      <Field label={t('cash.reverseReason')} required>
        {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
    </Dialog>
  );
}

export function CashPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const shift = useCurrentShift();
  const config = useConfig();
  const open = !!shift.data?.shift;
  const list = useCashList(open);
  if (shift.isLoading || config.isLoading) return <Skeleton className="h-96" />;
  if (!open) {
    return (
      <EmptyState
        icon={<Wallet />}
        title={t('cash.noShift')}
        action={
          <Button asChild>
            <Link to="/shift">{t('nav.shift')}</Link>
          </Button>
        }
      />
    );
  }
  const items = list.data?.items ?? [];
  const reversed = new Set(items.map((i) => i.reversesId).filter(Boolean));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('legacy.recordCash')}</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[26rem_1fr]">
        <CashForm approvalAbove={config.data?.settings.cashOut.approvalAboveCents ?? 0} />
        <section aria-labelledby="cash-recent" className="flex flex-col gap-3">
          <h2 id="cash-recent" className="font-display text-lg font-bold">
            {t('cash.thisShift')}
          </h2>
          {!items.length ? (
            <EmptyState title={t('cash.none')} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {items.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  <span className="w-12 text-xs text-fg-muted">{time(m.createdAt)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {m.categoryCode} · {m.categoryName}
                    </p>
                    <p className="truncate text-xs text-fg-muted">
                      {m.paidTo}
                      {m.description ? ` · ${m.description}` : ''}
                      {m.reason ? ` · ${m.reason}` : ''}
                    </p>
                  </div>
                  <Badge tone={m.type === 'EXPENSE' ? 'warning' : 'info'}>
                    {t(m.type === 'EXPENSE' ? 'cash.expense' : 'cash.deposit')}
                  </Badge>
                  <span className="tabular w-28 text-right font-semibold">
                    {formatLKR(m.amountCents)}
                  </span>
                  {can('cash.reverse') && !m.reversesId && !reversed.has(m.id) ? (
                    <ReverseButton m={m} />
                  ) : (
                    <span className="w-11" />
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

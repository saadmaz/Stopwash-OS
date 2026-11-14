import {
  denominationTotal,
  emptyCount,
  formatLKR,
  type Reconciliation,
  type Shift,
  type WhatsappAlert,
} from '@stopwash/shared';
import {
  Button,
  cn,
  DenominationCounter,
  Field,
  Input,
  Select,
  Sheet,
  Skeleton,
  Textarea,
  toast,
  type DenominationCount,
} from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isManager, useDeviceStaff } from '@/features/auth/useDeviceStaff';
import { useConfig } from '@/features/settings/useConfig';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Summary {
  shift: Shift;
  reconciliation: Reconciliation;
  vehicleCount: number;
  openOrders: number;
}
export interface CloseResult {
  close: { id: string; shiftId: string; varianceCents: number };
  reconciliation: Reconciliation;
  whatsapp: WhatsappAlert[];
}

const pinInput = (v: string) => v.replace(/\D/g, '').slice(0, 6);

export function CloseShiftSheet({
  shift,
  onClose,
  onClosed,
}: {
  shift: Shift;
  onClose: () => void;
  onClosed: (r: CloseResult) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useSession();
  const config = useConfig();
  const staff = useDeviceStaff();
  const summary = useQuery({
    queryKey: ['shift', shift.id, 'summary'],
    queryFn: () => api<Summary>(`/shifts/${shift.id}/summary`),
  });
  const [count, setCount] = useState<DenominationCount>(emptyCount);
  const [notes, setNotes] = useState('');
  const [handoverId, setHandoverId] = useState('');
  const [handoverPin, setHandoverPin] = useState('');
  const [overrideId, setOverrideId] = useState('');
  const [overridePin, setOverridePin] = useState('');
  const [key] = useState(() => crypto.randomUUID());

  const settings = config.data?.settings;
  const r = summary.data?.reconciliation;
  const counted = settings ? denominationTotal(settings.denominations, count) : 0;
  const counting = Object.values(count.notes).some((n) => n > 0) || count.coinsCents > 0;
  const variance = r && counting ? counted - r.expectedCents : null;
  const abs = Math.abs(variance ?? 0);
  const needsNotes = !!settings && abs > settings.variance.explainAboveCents;
  const needsOverride = !!settings && abs > settings.variance.overrideAboveCents;

  const close = useMutation({
    mutationFn: () =>
      api<CloseResult>(`/shifts/${shift.id}/close`, {
        idempotencyKey: key,
        body: {
          closingCount: count,
          notes,
          handover: { employeeId: handoverId, pin: handoverPin },
          override: needsOverride ? { employeeId: overrideId, pin: overridePin } : null,
        },
      }),
    onSuccess: (res) => {
      toast.success(t('closeShift.closed'));
      void qc.invalidateQueries({ queryKey: ['shift'] });
      onClosed(res);
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });

  const ready =
    counting &&
    handoverId &&
    handoverPin.length >= 4 &&
    (!needsNotes || notes.trim()) &&
    (!needsOverride || (overrideId && overridePin.length >= 4));
  const row = (label: string, cents: number, sign = '') => (
    <div className="flex justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="tabular font-semibold">
        {sign}
        {formatLKR(cents)}
      </dd>
    </div>
  );
  const others = (staff.data ?? []).filter((s) => s.canOpenShift && s.id !== user?.employeeId);

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('legacy.endShift')}
      description={shift.supervisorName}
      footer={
        <Button
          size="xl"
          block
          variant="secondary"
          disabled={!ready}
          loading={close.isPending}
          onClick={() => close.mutate()}
        >
          {t('closeShift.closeAndSign')}
        </Button>
      }
    >
      {!r || !settings ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="flex flex-col gap-5">
          {summary.data!.openOrders > 0 && (
            <p className="flex items-center gap-2 rounded-md bg-warning-subtle p-3 text-sm font-medium text-warning-fg">
              <AlertTriangle className="size-4" aria-hidden />
              {t('closeShift.openOrders', { count: summary.data!.openOrders })}
            </p>
          )}
          <dl className="grid gap-1.5 rounded-lg bg-surface-2 p-4 text-sm">
            {row(t('closeShift.opening'), r.openingCents)}
            {row(t('closeShift.cashSales'), r.cashSalesCents, '+ ')}
            {row(t('closeShift.cardSales'), r.cardSalesCents)}
            {row(t('closeShift.expenses'), r.expensesCents, '− ')}
            {row(t('closeShift.deposits'), r.depositsCents, '− ')}
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-base">
              <dt className="font-semibold">{t('closeShift.expected')}</dt>
              <dd className="tabular font-bold">{formatLKR(r.expectedCents)}</dd>
            </div>
          </dl>
          <DenominationCounter
            denominations={settings.denominations}
            value={count}
            onChange={setCount}
            labels={{
              coins: t('shift.coins'),
              total: t('closeShift.counted'),
              count: (n) => t('shift.noteCount', { note: n }),
            }}
          />
          {variance !== null && (
            <div
              role="status"
              className={cn(
                'rounded-lg p-4 text-center',
                variance === 0
                  ? 'bg-success-subtle text-success-fg'
                  : needsNotes
                    ? 'bg-danger-subtle text-danger-fg'
                    : 'bg-warning-subtle text-warning-fg',
              )}
            >
              <p className="text-sm font-semibold">
                {t(
                  variance === 0
                    ? 'closeShift.matched'
                    : variance < 0
                      ? 'closeShift.shortage'
                      : 'closeShift.overage',
                )}
              </p>
              <p className="tabular font-display text-2xl font-bold">{formatLKR(variance)}</p>
            </div>
          )}
          <Field
            label={t('closeShift.notes')}
            required={needsNotes}
            hint={
              needsNotes
                ? t('closeShift.notesRequired', {
                    amount: formatLKR(settings.variance.explainAboveCents),
                  })
                : undefined
            }
          >
            {(p) => (
              <Textarea {...p} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            )}
          </Field>
          {needsOverride && (
            <div className="grid gap-3 rounded-md bg-danger-subtle p-3 sm:grid-cols-2">
              <p className="text-sm font-medium text-danger-fg sm:col-span-2">
                {t('closeShift.needsOverride', {
                  amount: formatLKR(settings.variance.overrideAboveCents),
                })}
              </p>
              <Field label={t('checkout.approver')}>
                {(p) => (
                  <Select
                    {...p}
                    value={overrideId}
                    onValueChange={setOverrideId}
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
                    value={overridePin}
                    onChange={(e) => setOverridePin(pinInput(e.target.value))}
                  />
                )}
              </Field>
            </div>
          )}
          <fieldset className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold">{t('closeShift.handover')}</legend>
            <Field label={t('closeShift.incoming')}>
              {(p) => (
                <Select
                  {...p}
                  value={handoverId}
                  onValueChange={setHandoverId}
                  placeholder={t('shift.chooseSupervisor')}
                  options={others.map((s) => ({ value: s.id, label: s.name }))}
                />
              )}
            </Field>
            <Field label={t('closeShift.incomingPin')}>
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={handoverPin}
                  onChange={(e) => setHandoverPin(pinInput(e.target.value))}
                />
              )}
            </Field>
          </fieldset>
        </div>
      )}
    </Sheet>
  );
}

export function VarianceLinks({ links }: { links: WhatsappAlert[] }) {
  const { t } = useTranslation();
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((w) => (
        <Button key={w.url} variant="outline" size="sm" asChild>
          <a href={w.url} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden /> {t('checklistForm.send.variance', { phone: w.phone })}
          </a>
        </Button>
      ))}
    </div>
  );
}

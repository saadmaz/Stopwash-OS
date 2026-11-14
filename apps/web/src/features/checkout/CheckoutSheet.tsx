import { formatLKR, tryParseRupees, type Order, type Payment, type Tender } from '@stopwash/shared';
import {
  Badge,
  Button,
  Field,
  Input,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  Textarea,
  toast,
} from '@stopwash/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isManager, useDeviceStaff } from '@/features/auth/useDeviceStaff';
import { api, ApiError, errorKey } from '@/lib/api';

interface Quote {
  subtotalCents: number;
  loyaltyDiscountCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  discountNeedsApproval: boolean;
}

export interface CheckoutResult {
  order: Order;
  payments: Payment[];
}

type Method = 'CASH' | 'CARD' | 'SPLIT';

const lkr = <span className="text-xs font-semibold">LKR</span>;

export function CheckoutSheet({
  order,
  onClose,
  onPaid,
}: {
  order: Order;
  onClose: () => void;
  onPaid: (r: CheckoutResult) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [method, setMethod] = useState<Method>('CASH');
  const [discount, setDiscount] = useState('');
  const [reason, setReason] = useState('');
  const [received, setReceived] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [approverId, setApproverId] = useState('');
  const [approverPin, setApproverPin] = useState('');
  const [key] = useState(() => crypto.randomUUID());

  const discountCents = Math.max(0, tryParseRupees(discount) ?? 0);
  const quote = useQuery({
    queryKey: ['quote', order.id, discountCents],
    queryFn: () => api<Quote>(`/orders/${order.id}/quote?discountCents=${discountCents}`),
    placeholderData: keepPreviousData,
  });
  const q = quote.data;
  const total = q?.totalCents ?? 0;
  const needsApproval = !!q?.discountNeedsApproval;
  const staff = useDeviceStaff(needsApproval);
  const approvers = { data: staff.data?.filter(isManager) };

  let tenders: Tender[] = [];
  let tenderError: string | null = null;
  if (method === 'CASH' && total > 0) tenders = [{ method: 'CASH', amountCents: total }];
  if (method === 'CARD' && total > 0) tenders = [{ method: 'CARD', amountCents: total }];
  if (method === 'SPLIT') {
    const cash = tryParseRupees(splitCash) ?? 0;
    if (cash <= 0 || cash >= total) tenderError = t('checkout.splitInvalid');
    else
      tenders = [
        { method: 'CASH', amountCents: cash },
        { method: 'CARD', amountCents: total - cash },
      ];
  }
  const receivedCents = tryParseRupees(received);
  const change = method === 'CASH' && receivedCents !== null ? receivedCents - total : null;

  const pay = useMutation({
    mutationFn: () =>
      api<CheckoutResult>(`/orders/${order.id}/checkout`, {
        idempotencyKey: key,
        body: {
          tenders,
          discountCents,
          discountReason: reason || null,
          override: needsApproval ? { employeeId: approverId, pin: approverPin } : null,
        },
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(t('checkout.paid', { number: r.order.number }));
      onPaid(r);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'OVERRIDE_INVALID') setApproverPin('');
      toast.error(t(errorKey(e)));
    },
  });

  const ready =
    !!q &&
    !quote.isFetching &&
    !tenderError &&
    (total === 0 || tenders.length > 0) &&
    (discountCents === 0 || !!reason.trim()) &&
    (!needsApproval || (!!approverId && approverPin.length >= 4)) &&
    (change === null || change >= 0);

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('checkout.title', { plate: order.plateDisplay })}
      description={`#${order.ticket}`}
      footer={
        <Button
          size="xl"
          block
          disabled={!ready}
          loading={pay.isPending}
          onClick={() => pay.mutate()}
        >
          {t('checkout.pay', { amount: formatLKR(total) })}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-1.5 text-sm">
          {order.lines.map((l) => (
            <li key={l.itemId} className="flex justify-between">
              <span>
                {l.name}
                {l.qty > 1 && ` × ${l.qty}`}
              </span>
              <span className="tabular">{formatLKR(l.totalCents)}</span>
            </li>
          ))}
          {q && q.loyaltyDiscountCents > 0 && (
            <li className="flex justify-between text-success">
              <span>
                <Badge tone="success">{t('checkout.loyalty')}</Badge>
              </span>
              <span className="tabular">-{formatLKR(q.loyaltyDiscountCents)}</span>
            </li>
          )}
          {q && q.discountCents > 0 && (
            <li className="flex justify-between text-fg-muted">
              <span>{t('checkout.discount')}</span>
              <span className="tabular">-{formatLKR(q.discountCents)}</span>
            </li>
          )}
          {q && q.taxCents > 0 && (
            <li className="flex justify-between text-fg-muted">
              <span>{t('checkout.tax')}</span>
              <span className="tabular">{formatLKR(q.taxCents)}</span>
            </li>
          )}
        </ul>
        <div className="flex items-baseline justify-between rounded-lg bg-accent px-4 py-3 text-accent-fg">
          <span className="font-semibold">{t('common.total')}</span>
          {q ? (
            <span className="tabular font-display text-3xl font-bold" aria-live="polite">
              {formatLKR(total)}
            </span>
          ) : (
            <Skeleton className="h-9 w-32" />
          )}
        </div>

        <SegmentedControl
          aria-label={t('checkout.method')}
          size="lg"
          value={method}
          onValueChange={(v) => setMethod(v as Method)}
          options={[
            { value: 'CASH', label: t('checkout.cash') },
            { value: 'CARD', label: t('checkout.card') },
            { value: 'SPLIT', label: t('checkout.split') },
          ]}
        />
        {method === 'CASH' && (
          <Field
            label={t('checkout.received')}
            hint={
              change !== null && change >= 0
                ? t('checkout.change', { amount: formatLKR(change) })
                : undefined
            }
            error={change !== null && change < 0 ? t('checkout.notEnough') : undefined}
          >
            {(p) => (
              <Input
                {...p}
                inputSize="lg"
                inputMode="decimal"
                leading={lkr}
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            )}
          </Field>
        )}
        {method === 'SPLIT' && (
          <Field
            label={t('checkout.splitCash')}
            hint={
              !tenderError && tenders[1]
                ? t('checkout.splitCard', { amount: formatLKR(tenders[1].amountCents) })
                : undefined
            }
            error={splitCash ? (tenderError ?? undefined) : undefined}
          >
            {(p) => (
              <Input
                {...p}
                inputSize="lg"
                inputMode="decimal"
                leading={lkr}
                value={splitCash}
                onChange={(e) => setSplitCash(e.target.value)}
              />
            )}
          </Field>
        )}

        <details className="rounded-lg border border-border p-3" open={discountCents > 0}>
          <summary className="cursor-pointer text-sm font-semibold">
            {t('checkout.addDiscount')}
          </summary>
          <div className="mt-3 grid gap-3">
            <Field label={t('checkout.discount')}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="decimal"
                  leading={lkr}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              )}
            </Field>
            {discountCents > 0 && (
              <Field label={t('checkout.reason')} required>
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                )}
              </Field>
            )}
            {needsApproval && (
              <div className="grid gap-3 rounded-md bg-warning-subtle p-3">
                <p className="text-sm font-medium text-warning-fg">{t('checkout.needsApproval')}</p>
                <Field label={t('checkout.approver')}>
                  {(p) => (
                    <Select
                      {...p}
                      value={approverId}
                      onValueChange={setApproverId}
                      placeholder={t('checkout.chooseApprover')}
                      options={(approvers.data ?? []).map((a) => ({ value: a.id, label: a.name }))}
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
                      value={approverPin}
                      onChange={(e) => setApproverPin(e.target.value.replace(/\D/g, ''))}
                    />
                  )}
                </Field>
              </div>
            )}
          </div>
        </details>
      </div>
    </Sheet>
  );
}

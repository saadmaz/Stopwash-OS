import { formatLKR, multiply, sum, tryParseRupees, type Invoice } from '@stopwash/shared';
import { Badge, Button, Checkbox, EmptyState, Field, Input, Skeleton, toast } from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, FileDown, Plus, Trash2, Wallet } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadBlob } from '@/features/receipt/receiptPdf';
import { useConfig } from '@/features/settings/useConfig';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';
import { invoicePdf } from './invoicePdf';

type View = Invoice & { paidCents: number; status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOID' };
type Line = { description: string; qty: string; unit: string };
const TONE = { UNPAID: 'warning', PARTIAL: 'info', PAID: 'success', VOID: 'neutral' } as const;
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());

function NewInvoice({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const listId = useId();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: '1', unit: '' }]);
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState(false);
  const customers = useQuery({
    queryKey: ['billing-customers'],
    queryFn: () =>
      api<{ items: Array<{ name: string; address: string | null }> }>('/billing-customers'),
  });
  const parsed = lines.map((l) => ({
    description: l.description.trim(),
    qty: Number.parseInt(l.qty, 10),
    unitPriceCents: tryParseRupees(l.unit),
  }));
  const valid =
    name.trim() &&
    parsed.every(
      (l) => l.description && l.qty > 0 && l.unitPriceCents !== null && l.unitPriceCents >= 0,
    );
  const subtotal = valid ? sum(parsed.map((l) => multiply(l.unitPriceCents!, l.qty))) : 0;
  const discountCents = tryParseRupees(discount) ?? 0;
  const create = useMutation({
    mutationFn: () =>
      api<Invoice>('/invoices', {
        idempotencyKey: crypto.randomUUID(),
        body: {
          customer: { name: name.trim(), address: address.trim() || null },
          date,
          lines: parsed,
          discountCents,
          paid: paid ? { method: 'BANK_TRANSFER' } : null,
        },
      }),
    onSuccess: (inv) => {
      toast.success(t('invoices.created', { number: inv.number }));
      onDone();
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const set = (i: number, k: keyof Line, v: string) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) create.mutate();
      }}
    >
      <h2 className="font-display text-lg font-bold">{t('legacy.createInvoice')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('invoices.customer')} required>
          {(p) => (
            <Input
              {...p}
              list={listId}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                const c = customers.data?.items.find((x) => x.name === e.target.value);
                if (c?.address) setAddress(c.address);
              }}
            />
          )}
        </Field>
        <datalist id={listId}>
          {customers.data?.items.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
        <Field label={t('payroll.date')}>
          {(p) => (
            <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          )}
        </Field>
        <Field label={t('invoices.address')} className="sm:col-span-2">
          {(p) => <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} />}
        </Field>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_5rem_8rem_auto] items-end gap-2">
          <Field label={t('invoices.description')}>
            {(p) => (
              <Input
                {...p}
                value={l.description}
                onChange={(e) => set(i, 'description', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('invoices.qty')}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={l.qty}
                onChange={(e) => set(i, 'qty', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('invoices.unit')}>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                value={l.unit}
                onChange={(e) => set(i, 'unit', e.target.value)}
              />
            )}
          </Field>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('rules.removeTier')}
            disabled={lines.length === 1}
            onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLines((ls) => [...ls, { description: '', qty: '1', unit: '' }])}
        >
          <Plus aria-hidden /> {t('invoices.addLine')}
        </Button>
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-2">
        <Field label={t('checkout.discount')}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          )}
        </Field>
        <span className="flex items-center gap-2 pb-3">
          <Checkbox id="inv-paid" checked={paid} onCheckedChange={(v) => setPaid(v === true)} />
          <label htmlFor="inv-paid" className="text-sm">
            {t('invoices.paidNow')}
          </label>
        </span>
      </div>
      <p className="tabular text-right font-display text-xl font-bold">
        {formatLKR(Math.max(0, subtotal - discountCents))}
      </p>
      <Button
        type="submit"
        disabled={!valid || discountCents > subtotal}
        loading={create.isPending}
      >
        {t('invoices.issue')}
      </Button>
    </form>
  );
}

export function InvoicesPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const qc = useQueryClient();
  const config = useConfig();
  const q = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api<{ items: View[] }>('/invoices'),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['invoices'] });
  const act = useMutation({
    mutationFn: (v: { url: string; body: unknown }) =>
      api(v.url, { idempotencyKey: crypto.randomUUID(), body: v.body }),
    onSuccess: refresh,
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const pdf = async (inv: View) => {
    if (!config.data) return;
    downloadBlob(
      await invoicePdf(inv, config.data.settings.business, inv.paidCents),
      `Invoice_${inv.number}.pdf`,
    );
  };
  const write = can('invoice.write');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('nav.invoices')}</h1>
      <div className="grid items-start gap-6 xl:grid-cols-[30rem_1fr]">
        {write && <NewInvoice onDone={refresh} />}
        <section className="flex flex-col gap-3">
          {q.isLoading ? (
            <Skeleton className="h-40" />
          ) : !q.data?.items.length ? (
            <EmptyState title={t('invoices.none')} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {q.data.items.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      #{inv.number} · {inv.customerSnapshot.name}
                    </p>
                    <p className="text-xs text-fg-muted">{inv.date}</p>
                  </div>
                  <Badge tone={TONE[inv.status]}>{t(`invoices.status.${inv.status}`)}</Badge>
                  <span className="tabular w-32 text-right font-semibold">
                    {formatLKR(inv.totalCents)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('invoices.pdf', { number: inv.number })}
                    onClick={() => void pdf(inv)}
                  >
                    <FileDown aria-hidden />
                  </Button>
                  {write && inv.status !== 'VOID' && inv.status !== 'PAID' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('invoices.markPaid', { number: inv.number })}
                      onClick={() =>
                        act.mutate({
                          url: `/invoices/${inv.id}/settle`,
                          body: {
                            amountCents: inv.totalCents - inv.paidCents,
                            method: 'BANK_TRANSFER',
                          },
                        })
                      }
                    >
                      <Wallet aria-hidden />
                    </Button>
                  )}
                  {write && inv.status !== 'VOID' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('invoices.void', { number: inv.number })}
                      onClick={() => {
                        const reason = window.prompt(t('invoices.voidReason'));
                        if (reason?.trim())
                          act.mutate({ url: `/invoices/${inv.id}/void`, body: { reason } });
                      }}
                    >
                      <Ban aria-hidden />
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

import { formatLKR, nextFloorStatus, summarizeLines, type Order } from '@stopwash/shared';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  Pagination,
  SegmentedControl,
  Skeleton,
  StatCard,
  Textarea,
  toast,
} from '@stopwash/ui';
import {
  ArrowRight,
  Ban,
  ListOrdered,
  Pencil,
  ReceiptText,
  RotateCcw,
  Search,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '@/lib/api';
import { useHotkeys } from '@/lib/hotkeys';
import { useSession } from '@/lib/session';
import { CheckoutSheet } from '@/features/checkout/CheckoutSheet';
import { ReceiptDialog } from '@/features/receipt/ReceiptDialog';
import { EditOrderDialog, RefundDialog } from './OrderDialogs';
import { STATUS_TONE, useQueue, useSetStatus, type QueueFilter } from './useQueue';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Colombo',
  });

function CancelDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const setStatus = useSetStatus();
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('queue.cancelTitle', { plate: order.plateDisplay })}
      description={t('queue.cancelBody')}
      footer={
        <Button
          variant="danger"
          disabled={!reason.trim()}
          loading={setStatus.isPending}
          onClick={() =>
            setStatus.mutate(
              { id: order.id, status: 'CANCELLED', reason },
              { onSuccess: onClose, onError: (e) => toast.error(t(errorKey(e))) },
            )
          }
        >
          {t('queue.cancelOrder')}
        </Button>
      }
    >
      <Field label={t('queue.reason')} required>
        {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
    </Dialog>
  );
}

function Actions({
  order,
  onCancel,
  onPay,
  onReceipt,
  onEdit,
  onRefund,
}: {
  order: Order;
  onCancel: () => void;
  onPay: () => void;
  onReceipt: () => void;
  onEdit: () => void;
  onRefund: () => void;
}) {
  const { t } = useTranslation();
  const { can } = useSession();
  const setStatus = useSetStatus();
  const next = nextFloorStatus(order.status);
  const open = order.status !== 'COMPLETED' && order.status !== 'CANCELLED';
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {next && can('order.status') && (
        <Button
          size="sm"
          variant="outline"
          loading={setStatus.isPending}
          onClick={() =>
            setStatus.mutate(
              { id: order.id, status: next },
              { onError: (e) => toast.error(t(errorKey(e))) },
            )
          }
        >
          {t(`queue.to.${next}`)} <ArrowRight aria-hidden />
        </Button>
      )}
      {order.status === 'COMPLETED' && (
        <Button size="sm" variant="outline" onClick={onReceipt}>
          <ReceiptText aria-hidden /> {t('receipt.title')}
        </Button>
      )}
      {open && can('order.checkout') && (
        <Button size="sm" onClick={onPay}>
          <Wallet aria-hidden /> {t('queue.pay')}
        </Button>
      )}
      {open && can('order.update') && (
        <Button size="sm" variant="ghost" aria-label={t('orderEdit.action')} onClick={onEdit}>
          <Pencil aria-hidden />
        </Button>
      )}
      {order.status === 'COMPLETED' && can('order.refund') && (
        <Button size="sm" variant="ghost" aria-label={t('refund.short')} onClick={onRefund}>
          <Undo2 aria-hidden />
        </Button>
      )}
      {open && can('order.cancel') && (
        <Button size="sm" variant="ghost" aria-label={t('queue.cancelOrder')} onClick={onCancel}>
          <Ban aria-hidden />
        </Button>
      )}
    </div>
  );
}

export function QueuePage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<QueueFilter>({ status: 'OPEN', q: '', page: 1 });
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [paying, setPaying] = useState<Order | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  const [refunding, setRefunding] = useState<Order | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queue = useQueue(filter);
  useHotkeys({ '/': () => searchRef.current?.focus() });
  const data = queue.data;
  const pct = data ? (data.target.completed / Math.max(1, data.target.target)) * 100 : 0;

  let body;
  if (queue.isLoading)
    body = (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  else if (queue.isError)
    body = (
      <EmptyState
        tone="danger"
        title={t(errorKey(queue.error))}
        action={
          <Button variant="outline" onClick={() => void queue.refetch()}>
            {t('state.retry')}
          </Button>
        }
      />
    );
  else if (!data?.items.length)
    body = (
      <EmptyState
        icon={<ListOrdered />}
        title={filter.q ? t('queue.noMatches') : t('queue.empty')}
      />
    );
  else
    body = (
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {data.items.map((o) => (
          <li
            key={o.id}
            className="grid gap-3 p-3 sm:p-4 md:grid-cols-[5rem_1fr_auto_auto] md:items-center"
          >
            <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-0.5">
              <span className="font-display text-xl font-bold">#{o.ticket}</span>
              <span className="text-xs text-fg-muted">{time(o.createdAt)}</span>
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-bold tracking-wide">
                  {o.plateDisplay}
                </span>
                <Badge tone={STATUS_TONE[o.status]} dot>
                  {t(`queue.status.${o.status}`)}
                </Badge>
                {o.returning && (
                  <Badge tone="success">
                    <RotateCcw aria-hidden />
                    {t('queue.returning')}
                  </Badge>
                )}
              </p>
              <p className="truncate text-sm text-fg-muted">{summarizeLines(o.lines)}</p>
              {(o.customerName || o.customerPhone) && (
                <p className="text-xs text-fg-subtle">
                  {[o.customerName, o.customerPhone].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <p className="tabular text-right font-semibold md:min-w-28">
              {formatLKR(o.totalCents)}
            </p>
            <Actions
              order={o}
              onCancel={() => setCancelling(o)}
              onPay={() => setPaying(o)}
              onReceipt={() => setReceiptFor(o.id)}
              onEdit={() => setEditing(o)}
              onRefund={() => setRefunding(o)}
            />
          </li>
        ))}
      </ul>
    );

  const from = data && data.total ? (data.page - 1) * 10 + 1 : 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">{t('nav.queue')}</h1>
        <StatCard
          className="w-full sm:w-72"
          label={t('queue.target')}
          value={data ? `${data.target.completed} / ${data.target.target}` : '—'}
          progress={pct}
          loading={queue.isLoading}
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          ref={searchRef}
          aria-label={t('common.search')}
          placeholder={t('queue.searchPlaceholder')}
          leading={<Search className="size-4" />}
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value, page: 1 }))}
          className="sm:max-w-sm"
        />
        <SegmentedControl
          aria-label={t('queue.filter')}
          value={filter.status}
          onValueChange={(v) =>
            setFilter((f) => ({ ...f, status: v as QueueFilter['status'], page: 1 }))
          }
          options={[
            { value: 'OPEN', label: t('queue.open') },
            { value: 'COMPLETED', label: t('queue.done') },
            { value: 'ALL', label: t('queue.all') },
          ]}
          className="sm:max-w-xs"
        />
      </div>
      {body}
      {data && data.pageCount > 1 && (
        <Pagination
          page={data.page}
          pageCount={data.pageCount}
          onPageChange={(page) => setFilter((f) => ({ ...f, page }))}
          summary={t('queue.showing', {
            from,
            to: Math.min(from + 9, data.total),
            total: data.total,
          })}
          labels={{
            previous: t('queue.prev'),
            next: t('queue.next'),
            nav: t('queue.pages'),
            page: (n) => t('queue.page', { n }),
          }}
        />
      )}
      {cancelling && <CancelDialog order={cancelling} onClose={() => setCancelling(null)} />}
      {paying && (
        <CheckoutSheet
          order={paying}
          onClose={() => setPaying(null)}
          onPaid={(r) => {
            setPaying(null);
            setReceiptFor(r.order.id);
          }}
        />
      )}
      {receiptFor && <ReceiptDialog orderId={receiptFor} onClose={() => setReceiptFor(null)} />}
      {editing && <EditOrderDialog order={editing} onClose={() => setEditing(null)} />}
      {refunding && <RefundDialog order={refunding} onClose={() => setRefunding(null)} />}
    </div>
  );
}

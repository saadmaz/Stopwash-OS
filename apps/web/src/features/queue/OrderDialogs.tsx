import { formatLKR, type Order } from '@stopwash/shared';
import { Button, Dialog, Field, Input, Textarea, toast } from '@stopwash/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';

function useOrderMutation<T>(
  fn: (v: T) => Promise<unknown>,
  onDone: () => void,
  successKey: string,
) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success(t(successKey));
      onDone();
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
}

/** Fix plate or customer details on an unpaid order. A reason is recorded in the audit log. */
export function EditOrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const { t } = useTranslation();
  const [plate, setPlate] = useState(order.plateDisplay);
  const [name, setName] = useState(order.customerName ?? '');
  const [phone, setPhone] = useState(order.customerPhone ?? '');
  const [reason, setReason] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const save = useOrderMutation(
    () =>
      api(`/orders/${order.id}`, {
        method: 'PATCH',
        idempotencyKey: key,
        body: { plate, customerName: name || null, customerPhone: phone || null, reason },
      }),
    onClose,
    'orderEdit.saved',
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('orderEdit.title', { ticket: order.ticket })}
      description={t('orderEdit.body')}
      footer={
        <Button
          disabled={!plate.trim() || !reason.trim()}
          loading={save.isPending}
          onClick={() => save.mutate(undefined)}
        >
          {t('common.save')}
        </Button>
      }
    >
      <div className="grid gap-3">
        <Field label={t('pos.plate')} required>
          {(p) => (
            <Input
              {...p}
              className="uppercase"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('pos.customerName')}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={t('pos.phone')}>
            {(p) => (
              <Input
                {...p}
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label={t('orderEdit.reason')} required>
          {(p) => (
            <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

/** Full refund of a paid order (manager). Payments are reversed, never edited. */
export function RefundDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const refund = useOrderMutation(
    () => api(`/orders/${order.id}/refund`, { idempotencyKey: key, body: { reason } }),
    onClose,
    'refund.done',
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('refund.title', { plate: order.plateDisplay })}
      description={t('refund.body', { amount: formatLKR(order.paidCents) })}
      footer={
        <Button
          variant="danger"
          disabled={!reason.trim()}
          loading={refund.isPending}
          onClick={() => refund.mutate(undefined)}
        >
          {t('refund.action', { amount: formatLKR(order.paidCents) })}
        </Button>
      }
    >
      <Field label={t('refund.reason')} required>
        {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
    </Dialog>
  );
}

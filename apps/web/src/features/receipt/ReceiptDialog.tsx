import { Button, Dialog, EmptyState, Skeleton, toast } from '@stopwash/ui';
import { useQuery } from '@tanstack/react-query';
import { Download, MessageCircle, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';
import { buildReceipt, receiptWhatsappLink, type ReceiptData } from './receipt';
import { downloadBlob, receiptPdf } from './receiptPdf';

export function ReceiptDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['receipt', orderId],
    queryFn: () => api<ReceiptData>(`/orders/${orderId}/receipt`),
  });
  const m = q.data ? buildReceipt(q.data) : null;
  const wa = q.data ? receiptWhatsappLink(q.data) : null;

  const download = async () => {
    if (!m || !q.data) return;
    try {
      downloadBlob(
        await receiptPdf(m),
        `Receipt_${q.data.order.plateKey}_${q.data.order.number}.pdf`,
      );
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('receipt.title')}
      size="sm"
      footer={
        m && (
          <>
            {wa && (
              <Button variant="outline" asChild>
                <a href={wa} target="_blank" rel="noreferrer">
                  <MessageCircle aria-hidden /> {t('receipt.whatsapp')}
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden /> {t('receipt.print')}
            </Button>
            <Button onClick={() => void download()}>
              <Download aria-hidden /> {t('receipt.pdf')}
            </Button>
          </>
        )
      }
    >
      {q.isLoading && <Skeleton className="h-72" />}
      {q.isError && <EmptyState tone="danger" title={t(errorKey(q.error))} />}
      {m && (
        <div className="receipt-print rounded-lg border border-border bg-white p-4 font-mono text-[13px] text-ink">
          <p className="text-center font-sans text-base font-bold">{m.title}</p>
          {m.header.map((h) => (
            <p key={h} className="text-center text-xs">
              {h}
            </p>
          ))}
          <hr className="my-2 border-dashed border-steel" />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3">
            {m.meta.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>{k}</dt>
                <dd className="text-right font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <hr className="my-2 border-dashed border-steel" />
          {[m.lines, m.totals, m.payments].map((rows, i) => (
            <ul key={i} className={i ? 'mt-2' : undefined}>
              {rows.map((r) => (
                <li
                  key={r.label}
                  className={
                    r.emphasis ? 'flex justify-between text-base font-bold' : 'flex justify-between'
                  }
                >
                  <span>{r.label}</span>
                  <span>{r.amount}</span>
                </li>
              ))}
            </ul>
          ))}
          <hr className="my-2 border-dashed border-steel" />
          {m.footer.map((f) => (
            <p key={f} className="text-center text-xs">
              {f}
            </p>
          ))}
        </div>
      )}
    </Dialog>
  );
}

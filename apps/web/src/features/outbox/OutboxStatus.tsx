import { Badge, Button, Dialog, toast } from '@stopwash/ui';
import { useQueryClient } from '@tanstack/react-query';
import { CloudUpload, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { discard, flushOutbox, loadOutbox, useOutbox } from '@/lib/outbox';

const RETRY_MS = 30_000;

/** Header badge for orders taken offline; sends them when the connection returns. */
export function OutboxStatus() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const items = useOutbox();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const run = () =>
      void flushOutbox().then((sent) => {
        if (sent > 0) {
          toast.success(t('outbox.sent', { count: sent }));
          void qc.invalidateQueries({ queryKey: ['orders'] });
        }
      });
    void loadOutbox().then(run);
    window.addEventListener('online', run);
    const id = setInterval(run, RETRY_MS);
    return () => {
      window.removeEventListener('online', run);
      clearInterval(id);
    };
  }, [qc, t]);

  if (!items.length) return null;
  const failed = items.filter((i) => i.error).length;
  return (
    <>
      <button
        type="button"
        className="rounded-full focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => setOpen(true)}
      >
        <Badge tone={failed ? 'danger' : 'warning'} role="status">
          {failed ? <TriangleAlert aria-hidden /> : <CloudUpload aria-hidden />}
          {t('outbox.pending', { count: items.length })}
        </Badge>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t('outbox.title')}
        description={t('outbox.body')}
        footer={
          <Button onClick={() => void flushOutbox()} variant="outline">
            {t('outbox.retry')}
          </Button>
        }
      >
        <ul className="flex flex-col divide-y divide-border">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-3 py-2">
              <span className="flex-1 font-semibold">{i.label}</span>
              {i.error ? (
                <>
                  <Badge tone="danger">{t(`errors.${i.error}`)}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => void discard(i.key)}>
                    {t('outbox.discard')}
                  </Button>
                </>
              ) : (
                <Badge>{t('outbox.waiting')}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

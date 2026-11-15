import type { Order, OrderStatus } from '@stopwash/shared';
import { Maximize } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueue } from '@/features/queue/useQueue';
import { cn } from '@stopwash/ui';

const COLUMNS: Array<{ status: OrderStatus; accent: string }> = [
  { status: 'QUEUED', accent: 'border-steel' },
  { status: 'IN_PROGRESS', accent: 'border-sky-400' },
  { status: 'READY', accent: 'border-lime' },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Colombo',
  });
}

/** Ticket + plate only: the board faces the waiting area, so no names or phone numbers. */
export function BoardColumn({ status, orders }: { status: OrderStatus; orders: Order[] }) {
  const { t } = useTranslation();
  const accent = COLUMNS.find((c) => c.status === status)?.accent;
  return (
    <section
      aria-labelledby={`tv-${status}`}
      className={cn('flex min-h-0 flex-col rounded-2xl border-t-8 bg-white/5 p-6', accent)}
    >
      <h2 id={`tv-${status}`} className="mb-4 font-display text-4xl font-bold">
        {t(`queue.status.${status}`)}
        <span className="ml-3 text-white/50">{orders.length}</span>
      </h2>
      <ul className="flex min-h-0 flex-col gap-3 overflow-hidden">
        {orders.map((o) => (
          <li
            key={o.id}
            className={cn(
              'flex items-baseline gap-5 rounded-xl px-5 py-4',
              status === 'READY' ? 'bg-lime text-ink' : 'bg-white/10',
            )}
          >
            <span className="font-display text-5xl font-bold tabular">#{o.ticket}</span>
            <span className="font-display text-3xl tracking-wider">{o.plateDisplay}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TvBoardPage() {
  const { t } = useTranslation();
  const clock = useClock();
  const q = useQueue({ status: 'OPEN', q: '', page: 1, pageSize: 100 });
  const items = q.data?.items ?? [];
  return (
    <div className="flex h-dvh flex-col gap-6 bg-ink p-8 text-white">
      <header className="flex items-center gap-6">
        <p className="font-display text-5xl font-bold tracking-tight">
          STOP<span className="text-lime">WASH</span>
        </p>
        <p className="text-2xl text-white/70">{t('tv.subtitle')}</p>
        <span className="ml-auto font-display text-5xl font-bold tabular">{clock}</span>
        <button
          type="button"
          aria-label={t('tv.fullscreen')}
          className="rounded-lg p-3 text-white/60 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-lime"
          onClick={() => void document.documentElement.requestFullscreen?.()}
        >
          <Maximize aria-hidden className="size-8" />
        </button>
      </header>
      {q.isError && (
        <p role="alert" className="rounded-xl bg-red-900/60 p-4 text-2xl">
          {t('tv.offline')}
        </p>
      )}
      <main className="grid min-h-0 flex-1 grid-cols-3 gap-6">
        {COLUMNS.map((c) => (
          <BoardColumn
            key={c.status}
            status={c.status}
            orders={items.filter((o) => o.status === c.status)}
          />
        ))}
      </main>
    </div>
  );
}

import { formatLKR } from '@stopwash/shared';
import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDisplayState, type DisplayState } from './channel';
import { Logo } from '@/app/Logo';

export function DisplayView({ state }: { state: DisplayState }) {
  const { t } = useTranslation();
  if (state.kind === 'order') {
    return (
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6">
        <p className="font-display text-4xl tracking-wider text-white/80">{state.plate}</p>
        <ul className="flex flex-1 flex-col gap-3 overflow-hidden text-3xl">
          {state.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-6 border-b border-white/10 pb-3">
              <span>
                {l.name}
                {l.qty > 1 && <span className="text-white/60"> ×{l.qty}</span>}
              </span>
              <span className="tabular">{formatLKR(l.totalCents)}</span>
            </li>
          ))}
        </ul>
        {state.discountCents > 0 && (
          <p className="flex justify-between text-3xl text-lime">
            <span>{t('checkout.discount')}</span>
            <span className="tabular">-{formatLKR(state.discountCents)}</span>
          </p>
        )}
        <p className="flex items-baseline justify-between rounded-2xl bg-lime px-8 py-6 text-ink">
          <span className="font-display text-4xl font-bold">{t('display.total')}</span>
          <span className="font-display text-7xl font-bold tabular">
            {formatLKR(state.totalCents)}
          </span>
        </p>
      </div>
    );
  }
  if (state.kind === 'paid') {
    return (
      <div role="status" className="flex flex-col items-center gap-6 text-center">
        <CheckCircle2 aria-hidden className="size-32 text-lime" />
        <p className="font-display text-7xl font-bold">{t('display.thanks')}</p>
        <p className="text-3xl text-white/70">
          {t('display.paid', { amount: formatLKR(state.totalCents) })}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Logo className="h-24 text-lime" />
      <p className="text-3xl text-white/70">{t('display.welcome')}</p>
    </div>
  );
}

/** Customer-facing second screen at the counter. */
export function CustomerDisplayPage() {
  const state = useDisplayState();
  return (
    <div
      className="flex h-dvh items-center justify-center bg-ink p-12 text-white"
      aria-live="polite"
    >
      <DisplayView state={state} />
    </div>
  );
}

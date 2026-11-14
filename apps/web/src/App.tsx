import { formatLKR } from '@stopwash/shared';

export function App() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-fg">
      <div className="rounded-xl bg-surface p-8 shadow-md">
        <h1 className="font-display text-3xl font-bold">STOPWASH POS</h1>
        <p className="mt-2 text-fg-muted">
          Design tokens loaded. <span className="tabular">{formatLKR(0)}</span>
        </p>
        <span className="mt-4 inline-block rounded-md bg-primary px-3 py-1 text-sm font-semibold text-primary-fg">
          Ready
        </span>
      </div>
    </main>
  );
}

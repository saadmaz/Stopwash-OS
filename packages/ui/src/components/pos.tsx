import {
  denominationTotal,
  formatLKR,
  multiply,
  toRupeesString,
  tryParseRupees,
  type Cents,
} from '@stopwash/shared';
import { Delete, Minus, Plus } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';
import { cn } from '../cn';

/* ── Vehicle class tile ────────────────────────────── */

export interface VehicleClassTileProps {
  name: ReactNode;
  priceCents: Cents;
  icon?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  shortcut?: string;
}

/** Big touch tile; use inside a container with role="radiogroup". */
export function VehicleClassTile({
  name,
  priceCents,
  icon,
  selected,
  onSelect,
  shortcut,
}: VehicleClassTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'relative flex min-h-28 flex-col items-start justify-between gap-2 rounded-xl border-2 p-4 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        selected
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-border bg-surface text-fg hover:border-border-strong',
      )}
    >
      {icon && (
        <span
          className={cn(
            '[&_svg]:size-8',
            selected ? 'text-primary dark:text-ink' : 'text-fg-muted',
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="font-display text-lg leading-tight font-bold">{name}</span>
      <span
        className={cn('tabular text-sm font-semibold', selected ? 'opacity-90' : 'text-fg-muted')}
      >
        {formatLKR(priceCents, { compactZeroCents: true })}
      </span>
      {shortcut && (
        <kbd className="absolute top-2 right-2 rounded border border-current/30 px-1.5 text-xs opacity-60">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

/* ── Add-on stepper ────────────────────────────────── */

export interface AddOnStepperProps {
  name: ReactNode;
  unitPriceCents: Cents;
  qty: number;
  onChange: (qty: number) => void;
  max?: number;
  labels?: { decrease: string; increase: string };
}

export function AddOnStepper({
  name,
  unitPriceCents,
  qty,
  onChange,
  max = 99,
  labels,
}: AddOnStepperProps) {
  const id = useId();
  const btn =
    'grid size-11 place-items-center rounded-md border border-border-strong bg-surface text-fg hover:bg-surface-2 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring';
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-2 pl-3',
        qty > 0 ? 'border-accent bg-surface-2' : 'border-border bg-surface',
      )}
    >
      <div className="min-w-0 flex-1">
        <p id={id} className="truncate font-medium text-fg">
          {name}
        </p>
        <p className="tabular text-xs text-fg-muted">
          {formatLKR(unitPriceCents, { compactZeroCents: true })}
          {qty > 1 &&
            ` × ${qty} = ${formatLKR(multiply(unitPriceCents, qty), { compactZeroCents: true })}`}
        </p>
      </div>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(qty - 1)}
        disabled={qty <= 0}
        aria-label={labels?.decrease ?? 'Decrease'}
        aria-describedby={id}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output
        className="tabular w-6 text-center text-lg font-bold"
        aria-live="polite"
        aria-labelledby={id}
      >
        {qty}
      </output>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(qty + 1)}
        disabled={qty >= max}
        aria-label={labels?.increase ?? 'Increase'}
        aria-describedby={id}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/* ── Denomination counter ──────────────────────────── */

export interface DenominationCount {
  /** note value in cents → number of notes */
  notes: Record<string, number>;
  coinsCents: Cents;
}

/** Same maths as the API (shared). */
export const countTotal = (denominations: readonly Cents[], count: DenominationCount): Cents =>
  denominationTotal(denominations, count);

export interface DenominationCounterProps {
  denominations: readonly Cents[];
  value: DenominationCount;
  onChange: (value: DenominationCount) => void;
  labels?: { coins: string; total: string; count: (note: string) => string };
}

export function DenominationCounter({
  denominations,
  value,
  onChange,
  labels,
}: DenominationCounterProps) {
  const l = labels ?? {
    coins: 'Coins (total value)',
    total: 'Total',
    count: (n: string) => `Number of ${n} notes`,
  };
  const setNote = (d: Cents, raw: string) => {
    const n = Math.max(0, Math.min(9999, Number.parseInt(raw, 10) || 0));
    onChange({ ...value, notes: { ...value.notes, [String(d)]: n } });
  };
  const input =
    'tabular h-11 w-24 rounded-md border border-input bg-surface px-2 text-right text-lg font-semibold focus-visible:border-ring focus-visible:outline-none focus-visible:shadow-(--shadow-focus)';
  return (
    <div className="flex flex-col gap-1.5">
      {denominations.map((d) => {
        const n = value.notes[String(d)] ?? 0;
        const label = formatLKR(d, { compactZeroCents: true });
        return (
          <div key={d} className="grid grid-cols-[1fr_auto_8rem] items-center gap-3">
            <span className="tabular font-semibold">{label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={input}
              aria-label={l.count(label)}
              value={n || ''}
              placeholder="0"
              onChange={(e) => setNote(d, e.target.value)}
            />
            <span className="tabular text-right text-fg-muted">
              {formatLKR(multiply(d, n), { currency: false })}
            </span>
          </div>
        );
      })}
      <div className="grid grid-cols-[1fr_auto_8rem] items-center gap-3">
        <span className="font-semibold">{l.coins}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          className={input}
          aria-label={l.coins}
          value={value.coinsCents ? toRupeesString(value.coinsCents) : ''}
          placeholder="0"
          onChange={(e) =>
            onChange({
              ...value,
              coinsCents: Math.max(0, tryParseRupees(e.target.value) ?? 0),
            })
          }
        />
        <span className="tabular text-right text-fg-muted">
          {formatLKR(value.coinsCents, { currency: false })}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-accent px-4 py-3 text-accent-fg">
        <span className="font-semibold">{l.total}</span>
        <span className="tabular font-display text-2xl font-bold" aria-live="polite">
          {formatLKR(countTotal(denominations, value))}
        </span>
      </div>
    </div>
  );
}

/* ── PIN pad ───────────────────────────────────────── */

export interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  error?: ReactNode;
  labels?: { pin: string; backspace: string };
}

export function PinPad({
  value,
  onChange,
  length = 4,
  onComplete,
  disabled,
  error,
  labels,
}: PinPadProps) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === 'back') return onChange(value.slice(0, -1));
    if (value.length >= length) return;
    const next = value + k;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const key =
    'grid h-16 place-items-center rounded-xl bg-surface-2 font-display text-2xl font-bold text-fg hover:bg-border active:scale-95 transition-transform disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring';
  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-5">
      <div
        role="status"
        aria-label={`${labels?.pin ?? 'PIN'}: ${value.length} / ${length}`}
        className="flex gap-3"
      >
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={cn(
              'size-4 rounded-full border-2',
              i < value.length ? 'border-accent bg-accent' : 'border-border-strong',
              error && 'border-danger',
            )}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="grid w-full grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            className={key}
            disabled={disabled}
            onClick={() => press(d)}
          >
            {d}
          </button>
        ))}
        <span />
        <button type="button" className={key} disabled={disabled} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          className={key}
          disabled={disabled}
          onClick={() => press('back')}
          aria-label={labels?.backspace ?? 'Backspace'}
        >
          <Delete className="size-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}

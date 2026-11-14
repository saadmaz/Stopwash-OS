import { Badge, cn, Input } from '@stopwash/ui';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useEffect, useId, useState, type KeyboardEvent, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { CustomerFields, FieldName, FieldsAction } from './customerFields';

interface LookupResponse {
  vehicles: Array<{
    plateKey: string;
    plateDisplay: string;
    visitCount: number;
    customer: { name: string | null; phone: string | null } | null;
  }>;
  customers: Array<{
    id: string;
    name: string | null;
    phone: string | null;
    plateKeys: string[];
    visitCount: number;
  }>;
}

interface Suggestion {
  key: string;
  label: string;
  hint?: string;
  value: string;
  fill: Partial<Record<FieldName, string | null>>;
  visits?: number;
}

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function suggestionsFor(field: FieldName, data: LookupResponse | undefined): Suggestion[] {
  if (!data) return [];
  if (field === 'plate') {
    return data.vehicles.map((v) => ({
      key: v.plateKey,
      label: v.plateDisplay,
      hint: [v.customer?.name, v.customer?.phone].filter(Boolean).join(' · '),
      value: v.plateDisplay,
      fill: { name: v.customer?.name ?? null, phone: v.customer?.phone ?? null },
      visits: v.visitCount,
    }));
  }
  return data.customers.map((c) => ({
    key: c.id,
    label: (field === 'phone' ? c.phone : c.name) ?? '',
    hint: field === 'phone' ? (c.name ?? undefined) : (c.phone ?? undefined),
    value: (field === 'phone' ? c.phone : c.name) ?? '',
    fill:
      field === 'phone'
        ? { name: c.name, plate: c.plateKeys.at(-1) ?? null }
        : { phone: c.phone, plate: c.plateKeys.at(-1) ?? null },
    visits: c.visitCount,
  }));
}

/** One field with an accessible suggestion list (combobox pattern). */
function LookupField({
  field,
  label,
  state,
  dispatch,
  size,
  inputRef,
  onReturning,
}: {
  field: FieldName;
  label: string;
  state: CustomerFields;
  dispatch: (a: FieldsAction) => void;
  size?: 'md' | 'xl';
  inputRef?: Ref<HTMLInputElement>;
  onReturning?: (visits: number | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const value = state.values[field];
  const q = useDebounced(value.trim());
  const minLen = field === 'plate' ? 2 : 3;
  const lookup = useQuery({
    queryKey: ['lookup', field, q],
    enabled: q.length >= minLen,
    staleTime: 60_000,
    queryFn: ({ signal }) =>
      api<LookupResponse>(`/lookup?${field}=${encodeURIComponent(q)}`, { signal }),
  });
  const items = suggestionsFor(field, lookup.data).filter((s) => s.value);
  const show = open && items.length > 0;

  const pick = (s: Suggestion) => {
    dispatch({ type: 'pick', field, value: s.value, fill: s.fill });
    if (field === 'plate') onReturning?.(s.visits ?? null);
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!show) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        ref={inputRef}
        inputSize={size}
        role="combobox"
        aria-expanded={show}
        aria-controls={`${id}-list`}
        aria-activedescendant={show ? `${id}-opt-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        className={cn(
          field === 'plate' && 'tracking-wide uppercase',
          state.filledBy[field] && 'bg-surface-2',
        )}
        inputMode={field === 'phone' ? 'tel' : 'text'}
        value={value}
        onChange={(e) => {
          dispatch({ type: 'type', field, value: e.target.value });
          if (field === 'plate') onReturning?.(null);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {show && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={t('pos.suggestions')}
          className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          {items.map((s, i) => (
            <li
              key={s.key}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              className={cn(
                'flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2',
                i === active && 'bg-surface-2',
              )}
            >
              <span className="font-semibold">{s.label}</span>
              <span className="truncate text-xs text-fg-muted">{s.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CustomerFieldsInput({
  state,
  dispatch,
  plateRef,
  returningVisits,
  onReturning,
}: {
  state: CustomerFields;
  dispatch: (a: FieldsAction) => void;
  plateRef?: Ref<HTMLInputElement>;
  returningVisits: number | null;
  onReturning: (visits: number | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <LookupField
        field="plate"
        label={t('pos.plate')}
        size="xl"
        state={state}
        dispatch={dispatch}
        inputRef={plateRef}
        onReturning={onReturning}
      />
      <div className="flex min-h-6 items-center gap-2">
        {returningVisits !== null && returningVisits > 0 && (
          <Badge tone="success">
            <RotateCcw aria-hidden /> {t('pos.returning', { count: returningVisits })}
          </Badge>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <LookupField field="phone" label={t('pos.phone')} state={state} dispatch={dispatch} />
        <LookupField field="name" label={t('pos.customerName')} state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}

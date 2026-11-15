import {
  formatLKR,
  priceOrder,
  PricingError,
  type CatalogItem,
  type Order,
} from '@stopwash/shared';
import { AddOnStepper, Button, EmptyState, Skeleton, toast, VehicleClassTile } from '@stopwash/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bike, Car, CarFront, Package, Truck } from 'lucide-react';
import { useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCustomerDisplay } from '@/features/display/channel';
import { orderDisplay } from '@/features/display/toDisplay';
import { api, errorKey } from '@/lib/api';
import { shortcutLabel, useHotkeys } from '@/lib/hotkeys';
import { useConfig } from '@/features/settings/useConfig';
import { emptyFields, fieldsReducer } from './customerFields';
import { CustomerFieldsInput } from './CustomerFieldsInput';

const ICONS: Record<string, ReactNode> = {
  bike: <Bike />,
  car: <Car />,
  suv: <CarFront />,
  van: <Truck />,
};

export function localName(name: CatalogItem['name'], lang: string): string {
  return (name as Record<string, string | undefined>)[lang] || name.en;
}

export function NewOrderPage() {
  const { t, i18n } = useTranslation();
  const config = useConfig();
  const qc = useQueryClient();
  const plateRef = useRef<HTMLInputElement>(null);
  const [fields, dispatch] = useReducer(fieldsReducer, emptyFields);
  const [vehicleClassId, setVehicleClassId] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [returning, setReturning] = useState<number | null>(null);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  const catalog = useMemo(() => config.data?.catalog ?? [], [config.data]);
  const byKind = (k: CatalogItem['kind']) => catalog.filter((c) => c.kind === k);
  const classes = byKind('vehicleClass');
  const lines = [
    ...(vehicleClassId ? [{ itemId: vehicleClassId, qty: 1 }] : []),
    ...Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([itemId, q]) => ({ itemId, qty: q })),
  ];
  const catalogMap = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  let preview: ReturnType<typeof priceOrder> | PricingError | null = null;
  if (lines.length) {
    try {
      preview = priceOrder(catalogMap, lines);
    } catch (e) {
      preview = e instanceof PricingError ? e : null;
    }
  }
  const priced = preview && !(preview instanceof PricingError) ? preview : null;
  useCustomerDisplay(
    priced ? orderDisplay(fields.values.plate.trim().toUpperCase(), priced.lines, priced) : null,
  );
  const ready = !!fields.values.plate.trim() && !!priced;

  const reset = () => {
    dispatch({ type: 'reset' });
    setVehicleClassId(null);
    setQty({});
    setReturning(null);
    plateRef.current?.focus();
  };

  const create = useMutation({
    mutationFn: () =>
      api<Order>('/orders', {
        body: {
          plate: fields.values.plate,
          customerName: fields.values.name,
          customerPhone: fields.values.phone,
          lines,
        },
        idempotencyKey: idemKey,
      }),
    onSuccess: (o) => {
      toast.success(t('pos.created', { ticket: o.ticket, plate: o.plateDisplay }));
      setIdemKey(crypto.randomUUID()); // next order gets a new key; retries above reuse this one
      void qc.invalidateQueries({ queryKey: ['orders'] });
      reset();
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const submit = () => ready && !create.isPending && create.mutate();

  useHotkeys({
    'mod+enter': submit,
    escape: reset,
    ...Object.fromEntries(
      classes
        .slice(0, 9)
        .map((c, i) => [String(i + 1), () => setVehicleClassId((v) => (v === c.id ? null : c.id))]),
    ),
  });

  if (config.isLoading)
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  if (config.isError)
    return (
      <EmptyState
        tone="danger"
        title={t(errorKey(config.error))}
        action={
          <Button variant="outline" onClick={() => void config.refetch()}>
            {t('state.retry')}
          </Button>
        }
      />
    );

  const stepper = (item: CatalogItem) => (
    <AddOnStepper
      key={item.id}
      name={localName(item.name, i18n.language)}
      unitPriceCents={item.priceCents}
      qty={qty[item.id] ?? 0}
      max={item.maxQty}
      onChange={(n) => setQty((q) => ({ ...q, [item.id]: Math.max(0, Math.min(item.maxQty, n)) }))}
      labels={{ decrease: t('pos.decrease'), increase: t('pos.increase') }}
    />
  );

  return (
    <form
      className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{t('nav.newOrder')}</h1>
          <a
            href="/display"
            target="_blank"
            rel="noopener"
            className="text-sm font-medium text-link underline-offset-4 hover:underline"
          >
            {t('display.open')}
          </a>
        </div>
        <CustomerFieldsInput
          state={fields}
          dispatch={dispatch}
          plateRef={plateRef}
          returningVisits={returning}
          onReturning={setReturning}
        />
        <section aria-labelledby="pos-class" className="flex flex-col gap-3">
          <h2 id="pos-class" className="font-display text-lg font-bold">
            {t('pos.vehicleClass')}
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="pos-class"
            className="grid grid-cols-2 gap-3 md:grid-cols-4"
          >
            {classes.map((c, i) => (
              <VehicleClassTile
                key={c.id}
                name={localName(c.name, i18n.language)}
                priceCents={c.priceCents}
                icon={ICONS[c.icon ?? ''] ?? <Car />}
                selected={vehicleClassId === c.id}
                onSelect={() => setVehicleClassId((v) => (v === c.id ? null : c.id))}
                shortcut={String(i + 1)}
              />
            ))}
          </div>
        </section>
        {(['addon', 'product'] as const).map((k) =>
          byKind(k).length ? (
            <section key={k} aria-labelledby={`pos-${k}`} className="flex flex-col gap-3">
              <h2 id={`pos-${k}`} className="font-display text-lg font-bold">
                {t(k === 'addon' ? 'pos.addons' : 'pos.products')}
              </h2>
              <div className="grid gap-2 md:grid-cols-2">{byKind(k).map(stepper)}</div>
            </section>
          ) : null,
        )}
      </div>

      <aside
        aria-label={t('pos.summary')}
        className="sticky top-20 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2 className="font-display text-lg font-bold">{t('pos.summary')}</h2>
        {priced ? (
          <ul className="flex flex-col gap-2 text-sm">
            {priced.lines.map((l) => (
              <li key={l.itemId} className="flex justify-between gap-3">
                <span>
                  {localName(catalog.find((c) => c.id === l.itemId)!.name, i18n.language)}
                  {l.qty > 1 && ` × ${l.qty}`}
                </span>
                <span className="tabular">{formatLKR(l.totalCents)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Package className="size-4" aria-hidden />
            {t(preview instanceof PricingError ? `pos.pricing.${preview.code}` : 'pos.pickService')}
          </p>
        )}
        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="font-semibold">{t('common.total')}</span>
          <span className="tabular font-display text-3xl font-bold" aria-live="polite">
            {formatLKR(priced?.totalCents ?? 0)}
          </span>
        </div>
        <Button type="submit" size="xl" block disabled={!ready} loading={create.isPending}>
          {t('pos.addOrder')}{' '}
          <kbd className="ml-1 text-xs opacity-70">{shortcutLabel('mod+enter')}</kbd>
        </Button>
        <Button type="button" variant="ghost" onClick={reset}>
          {t('pos.clear')}
        </Button>
      </aside>
    </form>
  );
}

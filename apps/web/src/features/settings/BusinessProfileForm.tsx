import { type Settings } from '@stopwash/shared';
import { Button, Field, Input, Textarea, toast } from '@stopwash/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '@/lib/api';
import { useSaveSettings } from './useConfig';

type Key = keyof Settings['business'];
const FIELDS: Array<{ key: Key; max: number; multiline?: boolean }> = [
  { key: 'name', max: 80 },
  { key: 'address', max: 200 },
  { key: 'phone', max: 30 },
  { key: 'email', max: 80 },
  { key: 'taxId', max: 40 },
  { key: 'bankDetails', max: 300, multiline: true },
];

/** Name, contacts, tax ID and bank details printed on receipts, invoices and slips. */
export function BusinessProfileForm({ settings }: { settings: Settings }) {
  const { t } = useTranslation();
  const save = useSaveSettings();
  const [v, setV] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, settings.business[f.key] ?? ''])),
  );
  const [seed, setSeed] = useState(String(settings.invoice.nextNumberSeed));
  const seedNum = Number(seed);
  const valid = v.name?.trim() && Number.isInteger(seedNum) && seedNum > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const business = Object.fromEntries(
      FIELDS.map((f) => [f.key, v[f.key]!.trim() || (f.key === 'name' ? '' : null)]),
    ) as Settings['business'];
    save.mutate(
      { ...settings, business, invoice: { nextNumberSeed: seedNum } },
      {
        onSuccess: () => toast.success(t('settings.saved')),
        onError: (err) => toast.error(t(errorKey(err))),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm text-fg-muted">{t('business.hint')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field
            key={f.key}
            label={t(`business.${f.key}`)}
            required={f.key === 'name'}
            className={f.multiline ? 'sm:col-span-2' : undefined}
          >
            {(p) =>
              f.multiline ? (
                <Textarea
                  {...p}
                  rows={3}
                  maxLength={f.max}
                  value={v[f.key]}
                  onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              ) : (
                <Input
                  {...p}
                  maxLength={f.max}
                  value={v[f.key]}
                  onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              )
            }
          </Field>
        ))}
        <Field label={t('business.invoiceSeed')} hint={t('business.invoiceSeedHint')}>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div>
        <Button type="submit" size="lg" disabled={!valid} loading={save.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

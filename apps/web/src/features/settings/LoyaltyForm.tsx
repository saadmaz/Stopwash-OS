import type { Settings } from '@stopwash/shared';
import { Button, Checkbox, Field, Input, toast } from '@stopwash/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '@/lib/api';
import { useSaveSettings } from './useConfig';

/** Every Nth completed visit of a vehicle gets a % off its wash. Priced on the server. */
export function LoyaltyForm({ settings }: { settings: Settings }) {
  const { t } = useTranslation();
  const save = useSaveSettings();
  const [enabled, setEnabled] = useState(settings.loyalty.enabled);
  const [nth, setNth] = useState(String(settings.loyalty.everyNth));
  const [pct, setPct] = useState(String(settings.loyalty.rewardPct));
  const n = Number(nth);
  const p = Number(pct);
  const nthOk = Number.isInteger(n) && n >= 2 && n <= 50;
  const pctOk = Number.isFinite(p) && p >= 1 && p <= 100;
  return (
    <form
      noValidate
      className="flex max-w-xl flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nthOk || !pctOk) return;
        save.mutate(
          { ...settings, loyalty: { enabled, everyNth: n, rewardPct: p } },
          {
            onSuccess: () => toast.success(t('settings.saved')),
            onError: (err) => toast.error(t(errorKey(err))),
          },
        );
      }}
    >
      <p className="text-sm text-fg-muted">{t('loyalty.hint')}</p>
      <span className="flex items-center gap-2">
        <Checkbox
          id="loyalty-on"
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
        />
        <label htmlFor="loyalty-on" className="font-medium">
          {t('loyalty.enabled')}
        </label>
      </span>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('loyalty.everyNth')} error={nthOk ? undefined : t('loyalty.nthError')}>
          {(f) => (
            <Input
              {...f}
              inputMode="numeric"
              value={nth}
              onChange={(e) => setNth(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('loyalty.rewardPct')} error={pctOk ? undefined : t('loyalty.pctError')}>
          {(f) => (
            <Input
              {...f}
              inputMode="decimal"
              trailing="%"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          )}
        </Field>
      </div>
      {nthOk && pctOk && (
        <p className="rounded-lg bg-surface-2 p-3 text-sm">{t('loyalty.example', { n, pct: p })}</p>
      )}
      <div>
        <Button type="submit" size="lg" loading={save.isPending} disabled={!nthOk || !pctOk}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

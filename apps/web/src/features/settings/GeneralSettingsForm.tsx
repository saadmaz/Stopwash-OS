import { zodResolver } from '@hookform/resolvers/zod';
import { normalizePhone, toRupeesString, tryParseRupees, type Settings } from '@stopwash/shared';
import { Button, Field, Input, Textarea, toast } from '@stopwash/ui';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { errorKey } from '@/lib/api';
import { useSaveSettings } from './useConfig';

const rupees = z
  .string()
  .refine((v) => (tryParseRupees(v) ?? -1) >= 0, { message: 'settings.errors.amount' });
const phones = z
  .string()
  .refine((v) => splitPhones(v).every((p) => /^\+\d{9,15}$/.test(normalizePhone(p) ?? '')), {
    message: 'settings.errors.phones',
  });

const Form = z
  .object({
    dailyVehicleTarget: z.coerce.number().int().min(1).max(1000),
    explainAbove: rupees,
    overrideAbove: rupees,
    cashOutApprovalAbove: rupees,
    discountOverridePct: z.coerce.number().min(0).max(100),
    receiptFooter: z.string().max(200),
    stockPhones: phones,
    equipmentPhones: phones,
    variancePhones: phones,
  })
  .refine((v) => tryParseRupees(v.overrideAbove)! >= tryParseRupees(v.explainAbove)!, {
    path: ['overrideAbove'],
    message: 'settings.errors.overrideBelowExplain',
  });
type FormValues = z.input<typeof Form>;

function splitPhones(v: string): string[] {
  return v
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const toForm = (s: Settings): FormValues => ({
  dailyVehicleTarget: s.dailyVehicleTarget,
  explainAbove: toRupeesString(s.variance.explainAboveCents),
  overrideAbove: toRupeesString(s.variance.overrideAboveCents),
  cashOutApprovalAbove: toRupeesString(s.cashOut.approvalAboveCents),
  discountOverridePct: s.discount.overrideAbovePct,
  receiptFooter: s.receipt.footer ?? '',
  stockPhones: s.notificationNumbers.stock.join('\n'),
  equipmentPhones: s.notificationNumbers.equipment.join('\n'),
  variancePhones: s.notificationNumbers.variance.join('\n'),
});

export function GeneralSettingsForm({ settings }: { settings: Settings }) {
  const { t } = useTranslation();
  const save = useSaveSettings();
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(Form),
    defaultValues: toForm(settings),
  });
  const err = (k: keyof FormValues) => {
    const m = formState.errors[k]?.message;
    return m ? t(m.startsWith('settings.') ? m : 'settings.errors.invalid') : undefined;
  };

  const onSubmit = handleSubmit((raw) => {
    const v = Form.parse(raw);
    const phoneList = (s: string) => splitPhones(s).map((p) => normalizePhone(p)!);
    const next: Settings = {
      ...settings,
      dailyVehicleTarget: v.dailyVehicleTarget,
      variance: {
        explainAboveCents: tryParseRupees(v.explainAbove)!,
        overrideAboveCents: tryParseRupees(v.overrideAbove)!,
      },
      cashOut: { approvalAboveCents: tryParseRupees(v.cashOutApprovalAbove)! },
      discount: { overrideAbovePct: v.discountOverridePct },
      receipt: { ...settings.receipt, footer: v.receiptFooter.trim() || null },
      notificationNumbers: {
        stock: phoneList(v.stockPhones),
        equipment: phoneList(v.equipmentPhones),
        variance: phoneList(v.variancePhones),
      },
    };
    save.mutate(next, {
      onSuccess: () => toast.success(t('settings.saved')),
      onError: (e) => toast.error(t(errorKey(e))),
    });
  });

  const lkr = <span className="text-xs font-semibold">LKR</span>;
  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-8">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-bold">{t('settings.operations')}</legend>
        <Field
          label={t('settings.dailyTarget')}
          hint={t('settings.dailyTargetHint')}
          error={err('dailyVehicleTarget')}
        >
          {(p) => (
            <Input {...p} type="number" inputMode="numeric" {...register('dailyVehicleTarget')} />
          )}
        </Field>
        <Field
          label={t('settings.discountOverride')}
          hint={t('settings.discountOverrideHint')}
          error={err('discountOverridePct')}
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode="decimal"
              trailing="%"
              {...register('discountOverridePct')}
            />
          )}
        </Field>
        <Field
          label={t('settings.explainAbove')}
          hint={t('settings.explainAboveHint')}
          error={err('explainAbove')}
        >
          {(p) => <Input {...p} inputMode="decimal" leading={lkr} {...register('explainAbove')} />}
        </Field>
        <Field
          label={t('settings.overrideAbove')}
          hint={t('settings.overrideAboveHint')}
          error={err('overrideAbove')}
        >
          {(p) => <Input {...p} inputMode="decimal" leading={lkr} {...register('overrideAbove')} />}
        </Field>
        <Field
          label={t('settings.cashOutApproval')}
          hint={t('settings.cashOutApprovalHint')}
          error={err('cashOutApprovalAbove')}
        >
          {(p) => (
            <Input {...p} inputMode="decimal" leading={lkr} {...register('cashOutApprovalAbove')} />
          )}
        </Field>
        <Field label={t('settings.receiptFooter')} error={err('receiptFooter')}>
          {(p) => <Input {...p} {...register('receiptFooter')} />}
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-1 font-display text-lg font-bold">{t('settings.whatsapp')}</legend>
        <p className="text-sm text-fg-muted sm:col-span-3">{t('settings.whatsappHint')}</p>
        {(['stockPhones', 'equipmentPhones', 'variancePhones'] as const).map((k) => (
          <Field key={k} label={t(`settings.${k}`)} error={err(k)}>
            {(p) => <Textarea {...p} rows={3} placeholder="+94 77 123 4567" {...register(k)} />}
          </Field>
        ))}
      </fieldset>
      <div>
        <Button type="submit" size="lg" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

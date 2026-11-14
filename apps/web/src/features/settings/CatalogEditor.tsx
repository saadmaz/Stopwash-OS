import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatLKR,
  toRupeesString,
  tryParseRupees,
  type CatalogItem,
  type CatalogKind,
} from '@stopwash/shared';
import {
  Badge,
  Button,
  Dialog,
  Field,
  Input,
  Select,
  Switch,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
} from '@stopwash/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { api, errorKey } from '@/lib/api';

const KINDS: CatalogKind[] = ['vehicleClass', 'addon', 'product'];

const Form = z.object({
  kind: z.enum(['vehicleClass', 'addon', 'product']),
  code: z.string().regex(/^[A-Z0-9_]{2,32}$/, 'catalog.errors.code'),
  nameEn: z.string().trim().min(1, 'catalog.errors.name').max(80),
  nameSi: z.string().max(80),
  nameTa: z.string().max(80),
  price: z.string().refine((v) => (tryParseRupees(v) ?? -1) >= 0, 'settings.errors.amount'),
  maxQty: z.coerce.number().int().min(1).max(99),
  active: z.boolean(),
});
type FormValues = z.input<typeof Form>;

function ItemDialog({
  item,
  open,
  onOpenChange,
  nextSort,
}: {
  item: CatalogItem | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nextSort: number;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { register, handleSubmit, control, formState } = useForm<FormValues>({
    resolver: zodResolver(Form),
    defaultValues: item
      ? {
          kind: item.kind,
          code: item.code,
          nameEn: item.name.en,
          nameSi: item.name.si ?? '',
          nameTa: item.name.ta ?? '',
          price: toRupeesString(item.priceCents),
          maxQty: item.maxQty,
          active: item.active,
        }
      : {
          kind: 'addon',
          code: '',
          nameEn: '',
          nameSi: '',
          nameTa: '',
          price: '',
          maxQty: 1,
          active: true,
        },
  });
  const save = useMutation({
    mutationFn: (v: z.output<typeof Form>) => {
      const name = {
        en: v.nameEn,
        ...(v.nameSi ? { si: v.nameSi } : {}),
        ...(v.nameTa ? { ta: v.nameTa } : {}),
      };
      const common = {
        name,
        priceCents: tryParseRupees(v.price)!,
        maxQty: v.maxQty,
        active: v.active,
      };
      return item
        ? api<CatalogItem>(`/catalog/${item.id}`, { method: 'PATCH', body: common })
        : api<CatalogItem>('/catalog', {
            body: {
              ...common,
              kind: v.kind,
              code: v.code,
              description: null,
              locationIds: null,
              icon: null,
              sort: nextSort,
            },
          });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('settings.saved'));
      onOpenChange(false);
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const err = (k: keyof FormValues) => {
    const m = formState.errors[k]?.message;
    return m ? t(/^(catalog|settings)\./.test(m) ? m : 'settings.errors.invalid') : undefined;
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? t('catalog.edit') : t('catalog.add')}
      footer={
        <Button onClick={handleSubmit((v) => save.mutate(Form.parse(v)))} loading={save.isPending}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('catalog.kind')}>
          {(p) => (
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Select
                  {...p}
                  disabled={!!item}
                  value={field.value}
                  onValueChange={field.onChange}
                  options={KINDS.map((k) => ({ value: k, label: t(`catalog.kinds.${k}`) }))}
                />
              )}
            />
          )}
        </Field>
        <Field
          label={t('catalog.code')}
          hint={item ? t('catalog.codeLocked') : 'WAX, SMALL…'}
          error={err('code')}
        >
          {(p) => (
            <Input
              {...p}
              disabled={!!item}
              {...register('code', { setValueAs: (v: string) => v.toUpperCase().trim() })}
            />
          )}
        </Field>
        <Field label={t('catalog.nameEn')} error={err('nameEn')} required>
          {(p) => <Input {...p} {...register('nameEn')} />}
        </Field>
        <Field label={t('catalog.price')} error={err('price')} required>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              leading={<span className="text-xs font-semibold">LKR</span>}
              {...register('price')}
            />
          )}
        </Field>
        <Field label={t('catalog.nameSi')}>
          {(p) => <Input {...p} lang="si" {...register('nameSi')} />}
        </Field>
        <Field label={t('catalog.nameTa')}>
          {(p) => <Input {...p} lang="ta" {...register('nameTa')} />}
        </Field>
        <Field label={t('catalog.maxQty')} hint={t('catalog.maxQtyHint')} error={err('maxQty')}>
          {(p) => <Input {...p} type="number" inputMode="numeric" {...register('maxQty')} />}
        </Field>
        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <div className="flex items-center gap-3 self-end pb-2">
              <Switch id="cat-active" checked={field.value} onCheckedChange={field.onChange} />
              <label htmlFor="cat-active" className="text-sm font-medium">
                {t('catalog.active')}
              </label>
            </div>
          )}
        />
      </div>
    </Dialog>
  );
}

export function CatalogEditor({ items }: { items: CatalogItem[] }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [open, setOpen] = useState(false);
  const local = (n: CatalogItem['name']) =>
    (n as Record<string, string | undefined>)[i18n.language] ?? n.en;
  const openFor = (it: CatalogItem | null) => {
    setEditing(it);
    setOpen(true);
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => openFor(null)}>
          <Plus aria-hidden /> {t('catalog.add')}
        </Button>
      </div>
      <Table>
        <THead>
          <TR>
            <TH>{t('catalog.name')}</TH>
            <TH>{t('catalog.code')}</TH>
            <TH>{t('catalog.kind')}</TH>
            <TH className="text-right">{t('catalog.price')}</TH>
            <TH>{t('catalog.status')}</TH>
            <TH>
              <span className="sr-only">{t('common.edit')}</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {KINDS.flatMap((k) => items.filter((i) => i.kind === k)).map((it) => (
            <TR key={it.id} className={it.active ? undefined : 'opacity-60'}>
              <TD className="font-semibold">{local(it.name)}</TD>
              <TD>
                <code className="text-xs">{it.code}</code>
              </TD>
              <TD>{t(`catalog.kinds.${it.kind}`)}</TD>
              <TD className="tabular text-right">
                {formatLKR(it.priceCents)}
                {it.kind === 'product' && (
                  <span className="text-fg-muted"> / {t('catalog.unit')}</span>
                )}
              </TD>
              <TD>
                {it.active ? (
                  <Badge tone="success">{t('catalog.active')}</Badge>
                ) : (
                  <Badge>{t('catalog.inactive')}</Badge>
                )}
              </TD>
              <TD className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${t('common.edit')} ${local(it.name)}`}
                  onClick={() => openFor(it)}
                >
                  <Pencil aria-hidden />
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {open && (
        <ItemDialog
          key={editing?.id ?? 'new'}
          item={editing}
          open={open}
          onOpenChange={setOpen}
          nextSort={items.length}
        />
      )}
    </div>
  );
}

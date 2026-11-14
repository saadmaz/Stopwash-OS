import type { CashCategory, ChecklistItem } from '@stopwash/shared';
import { Badge, Button, Field, Input, SegmentedControl, Switch, toast } from '@stopwash/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';

function useConfigMutation<T>(fn: (v: T) => Promise<unknown>) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('settings.saved'));
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
}

function Row({
  title,
  meta,
  active,
  onToggle,
  label,
}: {
  title: ReactNode;
  meta: ReactNode;
  active: boolean;
  onToggle: (v: boolean) => void;
  label: string;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-fg-muted">{meta}</p>
      </div>
      {!active && <Badge>{label}</Badge>}
      <Switch checked={active} onCheckedChange={onToggle} aria-label={`${title}`} />
    </li>
  );
}

const list = 'divide-y divide-border rounded-lg border border-border bg-surface';

export function CashCategoryEditor({ items }: { items: CashCategory[] }) {
  const { t } = useTranslation();
  const [type, setType] = useState<'EXPENSE' | 'DEPOSIT'>('EXPENSE');
  const [name, setName] = useState('');
  const shown = items.filter((c) => c.type === type);
  const prefix = type === 'EXPENSE' ? 'E' : 'D';
  const nextCode = `${prefix}${String(shown.reduce((m, c) => Math.max(m, Number(c.code.slice(1))), 0) + 1).padStart(3, '0')}`;
  const toggle = useConfigMutation((v: { id: string; active: boolean }) =>
    api(`/cash-categories/${v.id}`, { method: 'PATCH', body: { active: v.active } }),
  );
  const add = useConfigMutation(() =>
    api('/cash-categories', {
      body: { type, code: nextCode, name: { en: name.trim() }, sort: items.length, active: true },
    }),
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) add.mutate(undefined, { onSuccess: () => setName('') });
  };
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <SegmentedControl
        aria-label={t('cashCategories.type')}
        value={type}
        onValueChange={(v) => setType(v as typeof type)}
        options={[
          { value: 'EXPENSE', label: t('cashCategories.expense') },
          { value: 'DEPOSIT', label: t('cashCategories.deposit') },
        ]}
        className="max-w-sm"
      />
      <ul className={list}>
        {shown.map((c) => (
          <Row
            key={c.id}
            title={c.name.en}
            meta={c.code}
            active={c.active}
            label={t('catalog.inactive')}
            onToggle={(active) => toggle.mutate({ id: c.id, active })}
          />
        ))}
      </ul>
      <form onSubmit={submit} className="flex items-end gap-2">
        <Field label={t('cashCategories.new', { code: nextCode })} className="flex-1">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Button type="submit" loading={add.isPending} disabled={!name.trim()}>
          {t('common.add')}
        </Button>
      </form>
    </div>
  );
}

export function ChecklistEditor({ items }: { items: ChecklistItem[] }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'stock' | 'equipment'>('stock');
  const [name, setName] = useState('');
  const shown = items.filter((c) => c.kind === kind);
  const toggle = useConfigMutation((v: { id: string; active: boolean }) =>
    api(`/checklist-items/${v.id}`, { method: 'PATCH', body: { active: v.active } }),
  );
  const add = useConfigMutation(() =>
    api('/checklist-items', {
      body: {
        kind,
        name: { en: name.trim() },
        okLabel: { en: kind === 'stock' ? 'Have stock' : 'Working' },
        faultLabel: { en: kind === 'stock' ? 'Running low' : 'Faulty' },
        sort: items.length,
        active: true,
      },
    }),
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) add.mutate(undefined, { onSuccess: () => setName('') });
  };
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <SegmentedControl
        aria-label={t('checklist.kind')}
        value={kind}
        onValueChange={(v) => setKind(v as typeof kind)}
        options={[
          { value: 'stock', label: t('checklist.stock') },
          { value: 'equipment', label: t('checklist.equipment') },
        ]}
        className="max-w-sm"
      />
      <ul className={list}>
        {shown.map((c) => (
          <Row
            key={c.id}
            title={c.name.en}
            meta={`${c.okLabel.en} / ${c.faultLabel.en}`}
            active={c.active}
            label={t('catalog.inactive')}
            onToggle={(active) => toggle.mutate({ id: c.id, active })}
          />
        ))}
      </ul>
      <form onSubmit={submit} className="flex items-end gap-2">
        <Field label={t('checklist.new')} className="flex-1">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Button type="submit" loading={add.isPending} disabled={!name.trim()}>
          {t('common.add')}
        </Button>
      </form>
    </div>
  );
}

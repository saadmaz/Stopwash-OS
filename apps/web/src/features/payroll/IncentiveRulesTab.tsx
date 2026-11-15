import { formatLKR, toRupeesString, tryParseRupees, type IncentiveRule } from '@stopwash/shared';
import { Button, Dialog, EmptyState, Field, Input, Skeleton, toast } from '@stopwash/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';

type TierRow = { target: string; bonus: string };
const toRows = (tiers: IncentiveRule['weekdayTiers']): TierRow[] =>
  tiers.map((t) => ({ target: String(t.target), bonus: toRupeesString(t.bonusCents) }));
const fromRows = (rows: TierRow[]) =>
  rows
    .filter((r) => r.target.trim() || r.bonus.trim())
    .map((r) => ({
      target: Number.parseInt(r.target, 10),
      bonusCents: tryParseRupees(r.bonus) ?? -1,
    }));
const rowsValid = (rows: TierRow[]) =>
  fromRows(rows).every((t) => Number.isInteger(t.target) && t.target > 0 && t.bonusCents > 0);

function TierEditor({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: TierRow[];
  onChange: (r: TierRow[]) => void;
}) {
  const { t } = useTranslation();
  const set = (i: number, k: keyof TierRow, v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label={t('rules.target')}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={r.target}
                onChange={(e) => set(i, 'target', e.target.value)}
              />
            )}
          </Field>
          <Field label={t('rules.bonus')}>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                value={r.bonus}
                onChange={(e) => set(i, 'bonus', e.target.value)}
              />
            )}
          </Field>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('rules.removeTier')}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { target: '', bonus: '' }])}
      >
        <Plus aria-hidden /> {t('rules.addTier')}
      </Button>
    </fieldset>
  );
}

function RuleDialog({ rule, onClose }: { rule: IncentiveRule | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState(rule?.name ?? '');
  const [weekday, setWeekday] = useState<TierRow[]>(
    rule ? toRows(rule.weekdayTiers) : [{ target: '', bonus: '' }],
  );
  const [weekend, setWeekend] = useState<TierRow[]>(
    rule ? toRows(rule.weekendTiers) : [{ target: '', bonus: '' }],
  );
  const [key] = useState(() => crypto.randomUUID());
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        weekdayTiers: fromRows(weekday),
        weekendTiers: fromRows(weekend),
      };
      return rule
        ? api(`/incentive-rules/${rule.id}`, { method: 'PATCH', idempotencyKey: key, body })
        : api('/incentive-rules', { idempotencyKey: key, body });
    },
    onSuccess: () => {
      toast.success(t('staff.saved'));
      void qc.invalidateQueries({ queryKey: ['incentive-rules'] });
      onClose();
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={rule ? t('rules.edit') : t('rules.add')}
      footer={
        <Button
          disabled={!name.trim() || !rowsValid(weekday) || !rowsValid(weekend)}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          {t('common.save')}
        </Button>
      }
    >
      <div className="grid gap-4">
        <Field label={t('rules.name')} required>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <p className="text-sm text-fg-muted">{t('rules.help')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <TierEditor label={t('rules.weekday')} rows={weekday} onChange={setWeekday} />
          <TierEditor label={t('rules.weekend')} rows={weekend} onChange={setWeekend} />
        </div>
      </div>
    </Dialog>
  );
}

export function IncentiveRulesTab() {
  const { t } = useTranslation();
  const { can } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<IncentiveRule | 'new' | null>(null);
  const q = useQuery({
    queryKey: ['incentive-rules'],
    queryFn: () => api<{ items: IncentiveRule[] }>('/incentive-rules'),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      api(`/incentive-rules/${id}`, {
        method: 'PATCH',
        idempotencyKey: crypto.randomUUID(),
        body: { archived: true },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incentive-rules'] }),
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const tiers = (list: IncentiveRule['weekdayTiers']) =>
    list.length
      ? list
          .map((x) => `${x.target}+: ${formatLKR(x.bonusCents, { compactZeroCents: true })}`)
          .join(', ')
      : t('rules.noTiers');
  const write = can('incentive.write');
  return (
    <div className="flex flex-col gap-4">
      {write && (
        <div>
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden /> {t('rules.add')}
          </Button>
        </div>
      )}
      {q.isLoading ? (
        <Skeleton className="h-32" />
      ) : !q.data?.items.length ? (
        <EmptyState title={t('rules.none')} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {q.data.items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-fg-muted">
                  {t('rules.weekday')}: {tiers(r.weekdayTiers)}
                </p>
                <p className="text-sm text-fg-muted">
                  {t('rules.weekend')}: {tiers(r.weekendTiers)}
                </p>
              </div>
              {write && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t('common.edit')} ${r.name}`}
                    onClick={() => setEditing(r)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('rules.archive', { name: r.name })}
                    onClick={() => archive.mutate(r.id)}
                  >
                    <Archive aria-hidden />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <RuleDialog rule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

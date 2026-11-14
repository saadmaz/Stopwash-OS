import type { Alert, Checklist, ChecklistItem, WhatsappAlert } from '@stopwash/shared';
import { Badge, Button, Field, SegmentedControl, Textarea, toast } from '@stopwash/ui';
import { useMutation } from '@tanstack/react-query';
import { CheckCheck, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, errorKey } from '@/lib/api';

export interface ChecklistResult {
  checklist: Checklist;
  alerts: Alert[];
  whatsapp: WhatsappAlert[];
}

type Status = 'OK' | 'FAULT';

function local(text: ChecklistItem['name'], lang: string) {
  return (text as Record<string, string | undefined>)[lang] || text.en;
}

/** WhatsApp buttons for alerts the server raised (click-to-chat; nothing is sent automatically). */
export function AlertLinks({ result }: { result: ChecklistResult }) {
  const { t } = useTranslation();
  if (!result.alerts.length) return null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning bg-warning-subtle p-4">
      {result.alerts.map((a) => (
        <p key={a.id} className="font-medium text-warning-fg">
          {a.message}
        </p>
      ))}
      {result.whatsapp.length ? (
        <div className="flex flex-wrap gap-2">
          {result.whatsapp.map((w) => (
            <Button key={w.url} variant="outline" size="sm" asChild>
              <a href={w.url} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden />{' '}
                {t(`checklistForm.send.${w.kind}`, { phone: w.phone })}
              </a>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-warning-fg">{t('checklistForm.noNumbers')}</p>
      )}
    </div>
  );
}

export function ChecklistForm({
  items,
  mode,
  onDone,
}: {
  items: ChecklistItem[];
  mode: 'PRE_SHIFT' | 'REQUEST';
  onDone: (r: ChecklistResult) => void;
}) {
  const { t, i18n } = useTranslation();
  const visible = mode === 'REQUEST' ? items.filter((i) => i.kind === 'stock') : items;
  const [answers, setAnswers] = useState<Record<string, Status>>(() =>
    Object.fromEntries(visible.map((i) => [i.id, 'OK' as Status])),
  );
  const [notes, setNotes] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const submit = useMutation({
    mutationFn: () =>
      api<ChecklistResult>('/checklists', {
        idempotencyKey: key,
        body: {
          kind: mode,
          entries: Object.entries(answers)
            .filter(([, s]) => mode === 'PRE_SHIFT' || s === 'FAULT')
            .map(([itemId, status]) => ({ itemId, status })),
          notes,
        },
      }),
    onSuccess: onDone,
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const anyLow = Object.values(answers).includes('FAULT');

  const section = (kind: ChecklistItem['kind']) => {
    const rows = visible.filter((i) => i.kind === kind);
    if (!rows.length) return null;
    return (
      <section aria-labelledby={`chk-${kind}`} className="flex flex-col gap-2">
        <h3 id={`chk-${kind}`} className="font-display text-lg font-bold">
          {t(kind === 'stock' ? 'legacy.stockCheck' : 'legacy.equipmentCheck')}
        </h3>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="min-w-36 flex-1 font-medium">{local(i.name, i18n.language)}</span>
              {answers[i.id] === 'FAULT' && (
                <Badge tone={kind === 'stock' ? 'warning' : 'danger'}>!</Badge>
              )}
              <SegmentedControl
                aria-label={local(i.name, i18n.language)}
                className="w-full sm:w-72"
                value={answers[i.id] ?? 'OK'}
                onValueChange={(v) => setAnswers((a) => ({ ...a, [i.id]: v as Status }))}
                options={[
                  { value: 'OK', label: local(i.okLabel, i18n.language) },
                  { value: 'FAULT', label: local(i.faultLabel, i18n.language) },
                ]}
              />
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button
          variant="outline"
          onClick={() => setAnswers(Object.fromEntries(visible.map((i) => [i.id, 'OK'])))}
        >
          <CheckCheck aria-hidden /> {t('checklistForm.allGood')}
        </Button>
      </div>
      {section('stock')}
      {section('equipment')}
      <Field label={t('checklistForm.notes')}>
        {(p) => (
          <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      <Button
        size="lg"
        loading={submit.isPending}
        disabled={mode === 'REQUEST' && !anyLow}
        onClick={() => submit.mutate()}
      >
        {t(mode === 'REQUEST' ? 'checklistForm.sendRequest' : 'legacy.saveAndNext')}
      </Button>
    </div>
  );
}

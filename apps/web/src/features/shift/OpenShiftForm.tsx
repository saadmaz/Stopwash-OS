import { denominationTotal, emptyCount, formatLKR, type Shift } from '@stopwash/shared';
import {
  Button,
  DenominationCounter,
  Field,
  Select,
  Textarea,
  toast,
  type DenominationCount,
} from '@stopwash/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeviceStaff } from '@/features/auth/useDeviceStaff';
import { api, errorKey } from '@/lib/api';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function OpenShiftForm({
  denominations,
  checklistId,
}: {
  denominations: number[];
  checklistId: string | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const now = useClock();
  const staff = useDeviceStaff();
  const [supervisor, setSupervisor] = useState('');
  const [count, setCount] = useState<DenominationCount>(emptyCount);
  const [notes, setNotes] = useState('');
  const [key] = useState(() => crypto.randomUUID());
  const open = useMutation({
    mutationFn: () =>
      api<Shift>('/shifts', {
        idempotencyKey: key,
        body: {
          supervisorEmployeeId: supervisor,
          checklistId,
          openingCount: count,
          carryoverNotes: notes,
        },
      }),
    onSuccess: (s) => {
      toast.success(t('shift.opened', { amount: formatLKR(s.openingCents) }));
      void qc.invalidateQueries({ queryKey: ['shift'] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const total = denominationTotal(denominations, count);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="open-count" className="flex flex-col gap-3">
        <h3 id="open-count" className="font-display text-lg font-bold">
          {t('shift.openingCount')}
        </h3>
        <DenominationCounter
          denominations={denominations}
          value={count}
          onChange={setCount}
          labels={{
            coins: t('shift.coins'),
            total: t('shift.openingTotal'),
            count: (n) => t('shift.noteCount', { note: n }),
          }}
        />
      </section>
      <aside className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <p className="tabular font-display text-3xl font-bold" aria-live="off">
          {now.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Colombo',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </p>
        <p className="text-sm text-fg-muted">
          {now.toLocaleDateString('en-GB', {
            timeZone: 'Asia/Colombo',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
        <Field label={t('shift.supervisor')} required>
          {(p) => (
            <Select
              {...p}
              value={supervisor}
              onValueChange={setSupervisor}
              placeholder={t('shift.chooseSupervisor')}
              options={(staff.data ?? [])
                .filter((s) => s.canOpenShift)
                .map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
        </Field>
        <Field label={t('shift.carryover')}>
          {(p) => (
            <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          )}
        </Field>
        <Button
          size="xl"
          block
          disabled={!supervisor}
          loading={open.isPending}
          onClick={() => open.mutate()}
        >
          {t('shift.start', { amount: formatLKR(total) })}
        </Button>
      </aside>
    </div>
  );
}

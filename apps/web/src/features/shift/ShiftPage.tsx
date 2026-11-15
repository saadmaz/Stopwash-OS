import { formatLKR } from '@stopwash/shared';
import { Button, EmptyState, Sheet, Skeleton, StatCard, toast } from '@stopwash/ui';
import { ClipboardList, PackageSearch } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@/features/settings/useConfig';
import { errorKey } from '@/lib/api';
import { useSession } from '@/lib/session';
import { AlertLinks, ChecklistForm, type ChecklistResult } from './ChecklistForm';
import { OpenShiftForm } from './OpenShiftForm';
import { CloseShiftSheet, VarianceLinks, type CloseResult } from './CloseShiftSheet';
import { downloadShiftReport } from './reconciliationPdf';
import { useCurrentShift } from './useShift';

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: '2-digit',
    minute: '2-digit',
  });

function OpenWizard() {
  const { t } = useTranslation();
  const { can } = useSession();
  const config = useConfig();
  const [step, setStep] = useState<'check' | 'alerts' | 'count'>('check');
  const [check, setCheck] = useState<ChecklistResult | null>(null);
  if (config.isLoading) return <Skeleton className="h-96" />;
  if (!config.data) return <EmptyState tone="danger" title={t(errorKey(config.error))} />;
  const steps = [t('shift.steps.check'), t('shift.steps.count')];
  const current = step === 'count' ? 1 : 0;
  return (
    <div className="flex flex-col gap-6">
      <ol className="flex gap-2" aria-label={t('shift.steps.label')}>
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? 'step' : undefined}
            className={
              i === current
                ? 'rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-fg'
                : 'rounded-full bg-surface-2 px-3 py-1 text-sm text-fg-muted'
            }
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      {step === 'check' && (
        <>
          <ChecklistForm
            items={config.data.checklistItems}
            mode="PRE_SHIFT"
            onDone={(r) => {
              setCheck(r);
              setStep(r.alerts.length ? 'alerts' : 'count');
            }}
          />
          {can('shift.close.override') && (
            <Button variant="link" onClick={() => setStep('count')}>
              {t('shift.skipCheck')}
            </Button>
          )}
        </>
      )}
      {step === 'alerts' && check && (
        <div className="flex max-w-2xl flex-col gap-4">
          <AlertLinks result={check} />
          <div>
            <Button size="lg" onClick={() => setStep('count')}>
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
      {step === 'count' && (
        <OpenShiftForm
          denominations={config.data.settings.denominations}
          checklistId={check?.checklist.id ?? null}
        />
      )}
    </div>
  );
}

export function ShiftPage() {
  const { t } = useTranslation();
  const shift = useCurrentShift();
  const config = useConfig();
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState<ChecklistResult | null>(null);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState<CloseResult | null>(null);
  const { can, signOut } = useSession();

  let body;
  if (shift.isLoading) body = <Skeleton className="h-64" />;
  else if (shift.isError)
    body = (
      <EmptyState
        tone="danger"
        title={t(errorKey(shift.error))}
        action={
          <Button variant="outline" onClick={() => void shift.refetch()}>
            {t('state.retry')}
          </Button>
        }
      />
    );
  else if (!shift.data?.shift && closed)
    body = (
      <div className="flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <p className="font-display text-xl font-bold">{t('closeShift.done')}</p>
        <p className="tabular">
          {t('closeShift.variance')}: {formatLKR(closed.close.varianceCents)}
        </p>
        <VarianceLinks links={closed.whatsapp} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void downloadShiftReport(closed.close.shiftId).catch(() =>
                toast.error(t('errors.generic')),
              )
            }
          >
            {t('closeShift.reportPdf')}
          </Button>
          <Button onClick={signOut}>{t('shell.switchUser')}</Button>
          <Button variant="outline" onClick={() => setClosed(null)}>
            {t('closeShift.openNext')}
          </Button>
        </div>
      </div>
    );
  else if (!shift.data?.shift) body = <OpenWizard />;
  else {
    const s = shift.data.shift;
    body = (
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('shift.openedAt')} value={time(s.openedAt)} icon={<ClipboardList />} />
          <StatCard label={t('shift.supervisor')} value={s.supervisorName} />
          <StatCard label={t('shift.openingTotal')} value={formatLKR(s.openingCents)} />
        </div>
        {s.carryoverNotes && (
          <p className="rounded-lg bg-surface-2 p-3 text-sm">{s.carryoverNotes}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setRequested(null);
              setRequesting(true);
            }}
          >
            <PackageSearch aria-hidden /> {t('legacy.requestStock')}
          </Button>
          {can('shift.close') && (
            <Button variant="danger" onClick={() => setClosing(true)}>
              {t('legacy.endShift')}
            </Button>
          )}
        </div>
        {closing && (
          <CloseShiftSheet
            shift={s}
            onClose={() => setClosing(false)}
            onClosed={(r) => {
              setClosing(false);
              setClosed(r);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">{t('nav.shift')}</h1>
      {body}
      {requesting && config.data && (
        <Sheet open onOpenChange={setRequesting} title={t('legacy.requestStock')}>
          {requested ? (
            <AlertLinks result={requested} />
          ) : (
            <ChecklistForm
              items={config.data.checklistItems}
              mode="REQUEST"
              onDone={setRequested}
            />
          )}
        </Sheet>
      )}
    </div>
  );
}

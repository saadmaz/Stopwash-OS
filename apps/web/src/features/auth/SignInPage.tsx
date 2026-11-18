import { Button, EmptyState, Field, Input, PinPad, Skeleton } from '@stopwash/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, MonitorSmartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher, ThemeToggle } from '@/app/AppShell';
import { Logo } from '@/app/Logo';
import { api, ApiError, errorKey } from '@/lib/api';
import { useSession, type SessionUser } from '@/lib/session';
import { loadDevice, saveDevice, type DeviceCredentials } from './device';

interface StaffTile {
  id: string;
  name: string;
  code: string;
  jobTitle: string;
  initials: string;
}

function RegisterDevice({ onSaved }: { onSaved: (d: DeviceCredentials) => void }) {
  const { t } = useTranslation();
  const [deviceId, setDeviceId] = useState('');
  const [deviceSecret, setDeviceSecret] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const d = { deviceId: deviceId.trim(), deviceSecret: deviceSecret.trim() };
    saveDevice(d);
    onSaved(d);
  };
  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <EmptyState
        icon={<MonitorSmartphone />}
        title={t('signIn.registerTitle')}
        description={t('signIn.registerBody')}
      />
      <Field label={t('signIn.deviceId')} required>
        {(p) => <Input {...p} value={deviceId} onChange={(e) => setDeviceId(e.target.value)} />}
      </Field>
      <Field label={t('signIn.deviceSecret')} required>
        {(p) => (
          <Input
            {...p}
            type="password"
            autoComplete="off"
            value={deviceSecret}
            onChange={(e) => setDeviceSecret(e.target.value)}
          />
        )}
      </Field>
      <Button
        type="submit"
        size="lg"
        disabled={!deviceId.trim() || deviceSecret.trim().length < 16}
      >
        {t('signIn.registerAction')}
      </Button>
    </form>
  );
}

export function SignInPage() {
  const { t } = useTranslation();
  const { signIn } = useSession();
  const [device, setDevice] = useState(loadDevice);
  const [selected, setSelected] = useState<StaffTile | null>(null);
  const [pin, setPin] = useState('');

  const staff = useQuery({
    queryKey: ['device-staff', device?.deviceId],
    enabled: !!device,
    retry: false,
    queryFn: () => api<{ staff: StaffTile[] }>('/auth/device/staff', { body: device }),
  });

  const login = useMutation({
    mutationFn: (p: string) =>
      api<{ token: string; user: SessionUser }>('/auth/pin', {
        body: { ...device, employeeId: selected?.id, pin: p },
      }),
    onSuccess: (r) => signIn(r.user, r.token),
    onError: () => setPin(''),
  });

  const deviceInvalid = staff.error instanceof ApiError && staff.error.code === 'DEVICE_INVALID';

  let body;
  if (!device || deviceInvalid) {
    body = <RegisterDevice onSaved={setDevice} />;
  } else if (staff.isLoading) {
    body = (
      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  } else if (staff.isError) {
    body = (
      <EmptyState
        tone="danger"
        title={t(errorKey(staff.error))}
        action={
          <Button variant="outline" onClick={() => void staff.refetch()}>
            {t('state.retry')}
          </Button>
        }
      />
    );
  } else if (!selected) {
    body = (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-center font-display text-2xl font-bold">{t('signIn.whoAreYou')}</h1>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {staff.data?.staff.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelected(s)}
                className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-3 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  className="grid size-11 place-items-center rounded-full bg-accent font-bold text-accent-fg"
                  aria-hidden
                >
                  {s.initials}
                </span>
                <span className="text-center text-sm leading-tight font-semibold">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => {
            setSelected(null);
            setPin('');
            login.reset();
          }}
        >
          <ArrowLeft aria-hidden /> {t('common.back')}
        </Button>
        <h1 className="font-display text-2xl font-bold">
          {t('signIn.enterPin', { name: selected.name })}
        </h1>
        <PinPad
          value={pin}
          onChange={setPin}
          onComplete={(p) => login.mutate(p)}
          disabled={login.isPending}
          error={login.error ? t(errorKey(login.error)) : undefined}
          labels={{ pin: t('signIn.pin'), backspace: t('signIn.backspace') }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between p-4">
        <Logo className="text-ink dark:text-lime" />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-4">{body}</main>
    </div>
  );
}

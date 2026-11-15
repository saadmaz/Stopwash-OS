import { Button, Dialog, Field, Textarea } from '@stopwash/ui';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  /** Ask for a required reason; the promise resolves to it. */
  reasonLabel?: string;
}

/** Resolves to `false` when cancelled, otherwise the reason ('' when none was asked for). */
type ConfirmFn = (o: ConfirmOptions) => Promise<string | false>;

const Ctx = createContext<ConfirmFn | null>(null);

/**
 * Accessible replacement for window.confirm / window.prompt: focus-trapped, translated,
 * keyboard-dismissable and announced as a dialog.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [reason, setReason] = useState('');
  const resolver = useRef<((v: string | false) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false);
    setReason('');
    setOpts(o);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (v: string | false) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };
  const needsReason = !!opts?.reasonLabel;
  const ok = !needsReason || reason.trim().length > 0;

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <Dialog
          open
          size="sm"
          onOpenChange={(o) => !o && finish(false)}
          title={opts.title}
          description={opts.description}
          footer={
            <>
              <Button variant="ghost" onClick={() => finish(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant={opts.tone === 'danger' ? 'danger' : 'primary'}
                disabled={!ok}
                onClick={() => finish(reason.trim())}
              >
                {opts.confirmLabel ?? t('common.confirm')}
              </Button>
            </>
          }
        >
          {needsReason && (
            <Field label={opts.reasonLabel!} required>
              {(p) => (
                <Textarea
                  {...p}
                  rows={3}
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </Field>
          )}
        </Dialog>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const fn = useContext(Ctx);
  if (!fn) throw new Error('useConfirm needs a ConfirmProvider');
  return fn;
}

import { useEffect, useState } from 'react';

/**
 * Counter → customer-facing display, same machine (second monitor / tab).
 * BroadcastChannel keeps it local: nothing leaves the device.
 */
export type DisplayState =
  | { kind: 'idle' }
  | {
      kind: 'order';
      plate: string;
      lines: Array<{ name: string; qty: number; totalCents: number }>;
      subtotalCents: number;
      discountCents: number;
      totalCents: number;
    }
  | { kind: 'paid'; totalCents: number };

const NAME = 'stopwash-display';
const PAID_HOLD_MS = 8_000;

function channel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(NAME);
}

export function publishDisplay(state: DisplayState) {
  const ch = channel();
  ch?.postMessage(state);
  ch?.close();
}

/** Publishes while mounted; returns the display to idle on unmount. */
export function useCustomerDisplay(state: DisplayState | null) {
  const key = JSON.stringify(state);
  useEffect(() => {
    if (state) publishDisplay(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content, not identity
  }, [key]);
  useEffect(() => () => publishDisplay({ kind: 'idle' }), []);
}

/** Display side. A "paid" screen holds for a few seconds unless a new order starts. */
export function useDisplayState(): DisplayState {
  const [state, setState] = useState<DisplayState>({ kind: 'idle' });
  useEffect(() => {
    const ch = channel();
    if (!ch) return;
    let holdUntil = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    ch.onmessage = (e: MessageEvent<DisplayState>) => {
      const next = e.data;
      if (next.kind === 'paid') {
        holdUntil = Date.now() + PAID_HOLD_MS;
        clearTimeout(timer);
        timer = setTimeout(() => setState({ kind: 'idle' }), PAID_HOLD_MS);
      } else if (next.kind === 'idle' && Date.now() < holdUntil) {
        return;
      } else {
        holdUntil = 0;
        clearTimeout(timer);
      }
      setState(next);
    };
    return () => {
      clearTimeout(timer);
      ch.close();
    };
  }, []);
  return state;
}

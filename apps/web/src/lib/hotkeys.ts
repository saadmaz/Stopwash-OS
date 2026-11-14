import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Shortcut strings: "mod+k" (Ctrl on Windows/Linux, ⌘ on Mac), "alt+n", "shift+/", "escape", "/".
 * Plain keys (no mod/alt) are ignored while the user is typing in a field.
 */
export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

export const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function isEditable(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return !!node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
}

export function matches(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop()!;
  const want = {
    mod: parts.includes('mod'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
  };
  const mod = isMac() ? e.metaKey : e.ctrlKey;
  if (want.mod !== mod || want.alt !== e.altKey) return false;
  if (want.shift && !e.shiftKey) return false;
  // Alt changes e.key on Mac (alt+n → "˜"), so compare the physical key code too.
  const k = e.key.toLowerCase();
  return k === key || e.code.toLowerCase() === `key${key}` || e.code.toLowerCase() === key;
}

export function useHotkeys(map: HotkeyMap, enabled = true): void {
  const ref = useRef(map);
  useLayoutEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      for (const [combo, fn] of Object.entries(ref.current)) {
        const modified = /(^|\+)(mod|alt)\+/.test(combo);
        if (!modified && isEditable(e.target)) continue;
        if (matches(combo, e)) {
          e.preventDefault();
          fn(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** Human label: "mod+k" → "Ctrl K" / "⌘ K". */
export function shortcutLabel(combo: string): string {
  return combo
    .split('+')
    .map((p) =>
      p === 'mod'
        ? isMac()
          ? '⌘'
          : 'Ctrl'
        : p === 'alt'
          ? isMac()
            ? '⌥'
            : 'Alt'
          : p.toUpperCase(),
    )
    .join(' ');
}

export const SHORTCUTS = {
  palette: 'mod+k',
  newOrder: 'alt+n',
  queue: 'alt+q',
  shift: 'alt+s',
  search: '/',
} as const;

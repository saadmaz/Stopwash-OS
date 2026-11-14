/** localStorage for per-device conveniences only (theme, language). Never throws. */
const PREFIX = 'sw:';

export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // private mode or storage blocked: preference just won't persist
  }
}

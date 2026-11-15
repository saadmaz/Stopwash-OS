/** RFC 4180 field: quoted when it contains a comma, quote, CR or LF; quotes doubled. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Neutralise spreadsheet formulas (=, +, -, @ at the start) from free-text fields.
  const safe = /^[=+@]/.test(s) || (/^-/.test(s) && !/^-?\d/.test(s)) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  return [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

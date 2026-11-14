/**
 * Normalisation for identifiers people type at the counter.
 */

/** Vehicle plate key: uppercase, letters and digits only. "wp cab-1234" → "WPCAB1234". */
export function plateKey(input: string): string {
  return input
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^\p{L}\p{M}\p{N}]/gu, '');
}

/** Display form: trim, collapse spaces, uppercase. "wp  cab-1234 " → "WP CAB-1234". */
export function plateDisplay(input: string): string {
  return input.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Sri Lankan phone numbers to E.164 (+94XXXXXXXXX). Returns null for empty input.
 * Numbers that don't look Sri Lankan are kept as "+<digits>" if they had a +,
 * otherwise as digits.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hadPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0094')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) return `+94${digits.slice(1)}`;
  if (digits.length === 9 && /^[1-9]/.test(digits)) return `+94${digits}`;
  if (digits.length === 11 && digits.startsWith('94')) return `+${digits}`;
  return hadPlus ? `+${digits}` : digits;
}

/** wa.me wants digits only, no +. */
export function waNumber(phone: string): string {
  return (normalizePhone(phone) ?? '').replace(/\D/g, '');
}

export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

/** Collapse whitespace and trim; empty → null. */
export function cleanText(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const s = input.replace(/\s+/g, ' ').trim();
  return s.length ? s : null;
}

/** Initials for avatars: "Kasun Perera" → "KP". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

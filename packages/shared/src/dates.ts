/**
 * Date helpers. Timestamps are stored in UTC; the business day and all display
 * use the location's IANA time zone (Asia/Colombo by default).
 */

export const DEFAULT_TZ = 'Asia/Colombo';

/** YYYY-MM-DD */
export type DateKey = string;
/** YYYY-MM */
export type PeriodKey = string;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isDateKey(v: unknown): v is DateKey {
  if (typeof v !== 'string' || !DATE_KEY_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isPeriodKey(v: unknown): v is PeriodKey {
  return typeof v === 'string' && PERIOD_RE.test(v);
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, tz = DEFAULT_TZ): ZonedParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour! % 24,
    minute: out.minute!,
    second: out.second!,
  };
}

/** The business day (YYYY-MM-DD) that an instant falls on, in the given zone. */
export function businessDate(date: Date = new Date(), tz = DEFAULT_TZ): DateKey {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Hour of day 0–23 in the zone. */
export function zonedHour(date: Date, tz = DEFAULT_TZ): number {
  return zonedParts(date, tz).hour;
}

/** Offset of the zone from UTC at an instant, in minutes (Colombo = +330). */
export function tzOffsetMinutes(date: Date, tz = DEFAULT_TZ): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

/** Converts a wall-clock time in the zone to a UTC instant. */
export function zonedTimeToUtc(dateKey: DateKey, time = '00:00:00', tz = DEFAULT_TZ): Date {
  if (!isDateKey(dateKey)) throw new RangeError(`invalid date key ${dateKey}`);
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const [hh = 0, mm = 0, ss = 0] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  // Two passes handle zones with DST transitions; Colombo converges in one.
  let offset = tzOffsetMinutes(new Date(guess), tz);
  let utc = guess - offset * 60_000;
  const offset2 = tzOffsetMinutes(new Date(utc), tz);
  if (offset2 !== offset) {
    offset = offset2;
    utc = guess - offset * 60_000;
  }
  return new Date(utc);
}

/** [start, end) of a business day as UTC instants. */
export function businessDayRange(dateKey: DateKey, tz = DEFAULT_TZ): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(dateKey, '00:00:00', tz),
    end: zonedTimeToUtc(addDays(dateKey, 1), '00:00:00', tz),
  };
}

export function addDays(dateKey: DateKey, days: number): DateKey {
  if (!isDateKey(dateKey)) throw new RangeError(`invalid date key ${dateKey}`);
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Whole days from a to b (b − a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const toUtc = (k: DateKey) => {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date (zone-independent). */
export function dayOfWeek(dateKey: DateKey): number {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekend(dateKey: DateKey, weekendDays: readonly number[] = [0, 6]): boolean {
  return weekendDays.includes(dayOfWeek(dateKey));
}

export function periodOf(dateKey: DateKey): PeriodKey {
  return dateKey.slice(0, 7);
}

export function daysInPeriod(period: PeriodKey): DateKey[] {
  if (!isPeriodKey(period)) throw new RangeError(`invalid period ${period}`);
  const [y, m] = period.split('-').map(Number) as [number, number];
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${period}-${pad2(i + 1)}`);
}

export function addMonths(period: PeriodKey, months: number): PeriodKey {
  const [y, m] = period.split('-').map(Number) as [number, number];
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

/** Inclusive list of date keys from a to b. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const n = diffDays(from, to);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Same weekday one week earlier. */
export function sameDayLastWeek(dateKey: DateKey): DateKey {
  return addDays(dateKey, -7);
}

/** "YYMMDD" for receipt numbers. */
export function compactDate(dateKey: DateKey): string {
  return dateKey.slice(2).replaceAll('-', '');
}

import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  businessDate,
  businessDayRange,
  compactDate,
  dateRange,
  dayOfWeek,
  daysInPeriod,
  diffDays,
  isDateKey,
  isWeekend,
  tzOffsetMinutes,
  zonedHour,
  zonedTimeToUtc,
} from '../src/dates';

describe('business day in Asia/Colombo', () => {
  it('rolls over at local midnight, not UTC midnight', () => {
    // 18:29 UTC = 23:59 Colombo, same day
    expect(businessDate(new Date('2026-11-15T18:29:00Z'))).toBe('2026-11-15');
    // 18:30 UTC = 00:00 Colombo next day (the old payroll bug counted this on the 15th)
    expect(businessDate(new Date('2026-11-15T18:30:00Z'))).toBe('2026-11-16');
  });

  it('knows the +05:30 offset', () => {
    expect(tzOffsetMinutes(new Date('2026-06-01T00:00:00Z'))).toBe(330);
  });

  it('converts local wall time to UTC', () => {
    expect(zonedTimeToUtc('2026-11-15', '00:00:00').toISOString()).toBe('2026-11-14T18:30:00.000Z');
    expect(zonedTimeToUtc('2026-11-15', '09:15').toISOString()).toBe('2026-11-15T03:45:00.000Z');
  });

  it('gives a half-open UTC range for a business day', () => {
    const { start, end } = businessDayRange('2026-11-15');
    expect(start.toISOString()).toBe('2026-11-14T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-11-15T18:30:00.000Z');
  });

  it('reports the local hour', () => {
    expect(zonedHour(new Date('2026-11-15T03:45:00Z'))).toBe(9);
  });

  it('works in another zone for future multi-brand use', () => {
    expect(businessDate(new Date('2026-11-15T23:30:00Z'), 'Europe/London')).toBe('2026-11-15');
  });
});

describe('calendar helpers', () => {
  it('validates keys', () => {
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2026-13-01')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-01', '2026-11-15')).toBe(14);
    expect(dateRange('2026-11-29', '2026-12-01')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });

  it('identifies weekdays and weekends', () => {
    expect(dayOfWeek('2026-11-15')).toBe(0); // Sunday
    expect(isWeekend('2026-11-14')).toBe(true); // Saturday
    expect(isWeekend('2026-11-16')).toBe(false);
    expect(isWeekend('2026-11-13', [5])).toBe(true); // configurable
  });

  it('lists days in a pay period', () => {
    expect(daysInPeriod('2026-02')).toHaveLength(28);
    expect(daysInPeriod('2028-02')).toHaveLength(29);
    expect(daysInPeriod('2026-11')[0]).toBe('2026-11-01');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('compacts dates for receipt numbers', () => {
    expect(compactDate('2026-11-15')).toBe('261115');
  });
});

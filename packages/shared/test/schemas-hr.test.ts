import { describe, expect, it } from 'vitest';
import { AuditEntry, EmployeeInput, IncentiveRuleInput, LeaveInput, Pin } from '../src';

describe('hr schemas', () => {
  it('validates employee codes like the old app (SW001)', () => {
    const base = {
      code: 'SW001',
      name: 'Kasun Perera',
      phone: '0771234567',
      jobTitle: 'Washer',
      systemRole: null,
      locationIds: ['katubedda'],
      baseSalaryCents: 4500000,
      recurringDeductionCents: 0,
      recurringAdditionCents: 0,
      incentiveRuleId: null,
      canOpenShift: false,
    };
    expect(EmployeeInput.safeParse(base).success).toBe(true);
    expect(EmployeeInput.safeParse({ ...base, code: 'sw1' }).success).toBe(false);
    expect(EmployeeInput.safeParse({ ...base, baseSalaryCents: -1 }).success).toBe(false);
  });

  it('accepts 4–6 digit PINs only', () => {
    expect(Pin.safeParse('1234').success).toBe(true);
    expect(Pin.safeParse('123456').success).toBe(true);
    expect(Pin.safeParse('123').success).toBe(false);
    expect(Pin.safeParse('12a4').success).toBe(false);
  });

  it('requires leave to end on or after it starts (missing in the old app)', () => {
    const ok = {
      employeeId: 'e1',
      startDate: '2026-11-20',
      endDate: '2026-11-20',
      reason: 'Family',
    };
    expect(LeaveInput.safeParse(ok).success).toBe(true);
    const bad = LeaveInput.safeParse({ ...ok, endDate: '2026-11-19' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it('incentive tiers need positive targets and bonuses', () => {
    expect(
      IncentiveRuleInput.safeParse({
        name: 'Standard',
        weekdayTiers: [{ target: 10, bonusCents: 25000 }],
        weekendTiers: [],
      }).success,
    ).toBe(true);
    expect(
      IncentiveRuleInput.safeParse({
        name: 'X',
        weekdayTiers: [{ target: 0, bonusCents: 1 }],
        weekendTiers: [],
      }).success,
    ).toBe(false);
  });

  it('audit actions are dotted lowercase verbs', () => {
    const entry = {
      id: 'a1',
      brandId: 'stopwash',
      locationId: null,
      at: '2026-11-15T04:00:00.000Z',
      actorId: 'u1',
      actorName: 'Owner',
      actorRole: 'owner',
      action: 'order.create',
      entity: 'order',
      entityId: 'o1',
      before: null,
      after: { a: 1 },
      reason: null,
      requestId: null,
      deviceId: null,
    };
    expect(AuditEntry.safeParse(entry).success).toBe(true);
    expect(AuditEntry.safeParse({ ...entry, action: 'CREATE_ORDER' }).success).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { CheckoutInput, CreateOrderInput, Payment, Tender } from '../src';

describe('CreateOrderInput', () => {
  it('normalises optional customer fields', () => {
    const v = CreateOrderInput.parse({
      plate: ' wp cab-1234 ',
      customerName: '',
      lines: [{ itemId: 'small', qty: 1 }],
    });
    expect(v.plate).toBe('wp cab-1234');
    expect(v.customerName).toBeNull();
    expect(v.customerPhone).toBeNull();
    expect(v.assignedEmployeeId).toBeNull();
  });

  it('requires a plate and at least one line', () => {
    expect(
      CreateOrderInput.safeParse({ plate: ' ', lines: [{ itemId: 'x', qty: 1 }] }).success,
    ).toBe(false);
    expect(CreateOrderInput.safeParse({ plate: 'A1', lines: [] }).success).toBe(false);
  });

  it('rejects zero or fractional quantities', () => {
    expect(
      CreateOrderInput.safeParse({ plate: 'A1', lines: [{ itemId: 'x', qty: 0 }] }).success,
    ).toBe(false);
    expect(
      CreateOrderInput.safeParse({ plate: 'A1', lines: [{ itemId: 'x', qty: 1.5 }] }).success,
    ).toBe(false);
  });
});

describe('payments', () => {
  it('tenders must be positive whole cents', () => {
    expect(Tender.safeParse({ method: 'CASH', amountCents: 0 }).success).toBe(false);
    expect(Tender.safeParse({ method: 'CASH', amountCents: 10.5 }).success).toBe(false);
    expect(Tender.safeParse({ method: 'CHEQUE', amountCents: 100 }).success).toBe(false);
  });

  it('checkout defaults discount to zero and checks override PIN shape', () => {
    expect(
      CheckoutInput.parse({ tenders: [{ method: 'CARD', amountCents: 75000 }] }).discountCents,
    ).toBe(0);
    const bad = {
      tenders: [{ method: 'CASH', amountCents: 1 }],
      override: { employeeId: 'e1', pin: '12' },
    };
    expect(CheckoutInput.safeParse(bad).success).toBe(false);
  });

  it('a stored payment can be negative (reversal) but never zero', () => {
    const base = {
      id: 'p1',
      brandId: 'stopwash',
      locationId: 'katubedda',
      createdAt: '2026-11-15T04:00:00.000Z',
      createdBy: 'u1',
      orderId: 'o1',
      shiftId: 's1',
      businessDate: '2026-11-15',
      method: 'CASH',
      reversesId: 'p0',
      reason: 'wrong method',
    };
    expect(Payment.safeParse({ ...base, amountCents: -75000 }).success).toBe(true);
    expect(Payment.safeParse({ ...base, amountCents: 0 }).success).toBe(false);
  });
});

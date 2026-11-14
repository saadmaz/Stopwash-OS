import { describe, expect, it } from 'vitest';
import { initials, normalizePhone, plateDisplay, plateKey, whatsappLink } from '../src/normalize';
import { assignableRoles, can, parseClaims, ROLE_PERMISSIONS } from '../src/rbac';

describe('plates', () => {
  it('normalises keys so spacing and dashes do not create duplicates', () => {
    expect(plateKey('wp cab-1234')).toBe('WPCAB1234');
    expect(plateKey('WP CAB 1234')).toBe('WPCAB1234');
    expect(plateKey(' 19-1234 ')).toBe('191234');
    // zero-width joiner and spaces are ignored; Sinhala vowel signs are kept
    expect(plateKey('ශ්‍රී 1234')).toBe(plateKey('ශ්රී1234'));
    expect(plateKey('ශ්රී1234')).toBe('ශ්රී1234');
  });

  it('keeps a tidy display form', () => {
    expect(plateDisplay('  wp   cab-1234 ')).toBe('WP CAB-1234');
  });
});

describe('phones', () => {
  it.each([
    ['0771234567', '+94771234567'],
    ['077 123 4567', '+94771234567'],
    ['771234567', '+94771234567'],
    ['+94 77 123 4567', '+94771234567'],
    ['0094771234567', '+94771234567'],
    ['94771234567', '+94771234567'],
    ['+44 20 7946 0958', '+442079460958'],
  ])('%s → %s', (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });

  it('returns null for blank', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('  ')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it('builds wa.me links without the plus', () => {
    expect(whatsappLink('0771234567', 'Hi there')).toBe(
      'https://wa.me/94771234567?text=Hi%20there',
    );
  });

  it('makes initials', () => {
    expect(initials('Kasun Perera')).toBe('KP');
    expect(initials('nimal')).toBe('N');
  });
});

describe('rbac', () => {
  it('lets owners do everything', () => {
    expect(can('owner', 'settings.write.sensitive')).toBe(true);
    expect(can('owner', 'payroll.finalize')).toBe(true);
  });

  it('keeps cashiers on the floor', () => {
    expect(can('cashier', 'order.create')).toBe(true);
    expect(can('cashier', 'order.checkout')).toBe(true);
    expect(can('cashier', 'shift.close')).toBe(true);
    expect(can('cashier', 'order.cancel')).toBe(false);
    expect(can('cashier', 'payroll.read')).toBe(false);
    expect(can('cashier', 'shift.close.override')).toBe(false);
    expect(can('cashier', 'audit.read')).toBe(false);
  });

  it('gives accounts approval and read access but no operational writes', () => {
    expect(can('accounts', 'shift.approve')).toBe(true);
    expect(can('accounts', 'order.create')).toBe(false);
    expect(can('accounts', 'cash.create')).toBe(false);
  });

  it('separates duties: managers cannot approve EOD or change sensitive settings', () => {
    expect(can('manager', 'shift.approve')).toBe(false);
    expect(can('manager', 'settings.write.sensitive')).toBe(false);
    expect(can('manager', 'payroll.finalize')).toBe(true);
  });

  it('denies when there is no role', () => {
    expect(can(null, 'order.read')).toBe(false);
  });

  it('every role has at least the settings.read permission', () => {
    for (const set of Object.values(ROLE_PERMISSIONS)) expect(set.has('settings.read')).toBe(true);
  });

  it('limits who can assign roles', () => {
    expect(assignableRoles('owner')).toContain('owner');
    expect(assignableRoles('manager')).toEqual(['cashier', 'accounts']);
    expect(assignableRoles('cashier')).toEqual([]);
  });

  it('parses claims defensively', () => {
    expect(
      parseClaims({ role: 'cashier', brandId: 'stopwash', locationIds: ['katubedda', 3] }),
    ).toEqual({
      role: 'cashier',
      brandId: 'stopwash',
      locationIds: ['katubedda'],
      employeeId: null,
      deviceId: null,
    });
    expect(parseClaims({ role: 'admin', brandId: 'x', locationIds: [] })).toBeNull();
  });
});

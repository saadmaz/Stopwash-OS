import { emptyFields, fieldsReducer, type CustomerFields } from './customerFields';

const typed = (s: CustomerFields, field: 'plate' | 'phone' | 'name', value: string) =>
  fieldsReducer(s, { type: 'type', field, value });

describe('customer field autofill (SWOMS rules)', () => {
  it('a picked plate fills empty phone and name', () => {
    const s = fieldsReducer(emptyFields, {
      type: 'pick',
      field: 'plate',
      value: 'WP CAB-1234',
      fill: { phone: '+94771234567', name: 'Nimal' },
    });
    expect(s.values).toEqual({ plate: 'WP CAB-1234', phone: '+94771234567', name: 'Nimal' });
    expect(s.filledBy).toEqual({ phone: 'plate', name: 'plate' });
  });

  it('never overwrites what the user typed', () => {
    let s = typed(emptyFields, 'name', 'Kamal');
    s = fieldsReducer(s, {
      type: 'pick',
      field: 'plate',
      value: 'X1',
      fill: { name: 'Nimal', phone: '+9477' },
    });
    expect(s.values.name).toBe('Kamal');
    expect(s.values.phone).toBe('+9477');
  });

  it('editing the plate clears what the plate filled', () => {
    let s = fieldsReducer(emptyFields, {
      type: 'pick',
      field: 'plate',
      value: 'X1',
      fill: { name: 'Nimal' },
    });
    s = typed(s, 'plate', 'X12');
    expect(s.values).toEqual({ plate: 'X12', phone: '', name: '' });
  });

  it('a later pick from the same trigger replaces its own earlier fill', () => {
    let s = fieldsReducer(emptyFields, {
      type: 'pick',
      field: 'phone',
      value: '+94771',
      fill: { name: 'A' },
    });
    s = fieldsReducer(s, { type: 'pick', field: 'phone', value: '+94772', fill: { name: 'B' } });
    expect(s.values.name).toBe('B');
  });

  it('typing into an autofilled field takes ownership', () => {
    let s = fieldsReducer(emptyFields, {
      type: 'pick',
      field: 'plate',
      value: 'X1',
      fill: { name: 'Nimal' },
    });
    s = typed(s, 'name', 'Nimal P');
    s = typed(s, 'plate', 'X2');
    expect(s.values.name).toBe('Nimal P');
  });

  it('resets', () => {
    expect(fieldsReducer(typed(emptyFields, 'plate', 'A'), { type: 'reset' })).toEqual(emptyFields);
  });
});

import { describe, expect, it } from 'vitest';
import { csvField, toCsv } from '../src';

describe('csv', () => {
  it('escapes commas, quotes and newlines (the old export did not)', () => {
    expect(csvField('Small, wax')).toBe('"Small, wax"');
    expect(csvField('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvField('a\nb')).toBe('"a\nb"');
    expect(csvField(null)).toBe('');
    expect(csvField(1250.5)).toBe('1250.5');
  });

  it('neutralises formula injection but keeps negative numbers', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('-500.00')).toBe('-500.00');
    expect(csvField('-cmd')).toBe("'-cmd");
  });

  it('joins rows with CRLF', () => {
    expect(toCsv(['A', 'B'], [[1, 'x,y']])).toBe('A,B\r\n1,"x,y"\r\n');
  });
});

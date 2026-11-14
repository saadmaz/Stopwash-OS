import en from './locales/en.json';
import si from './locales/si.json';
import ta from './locales/ta.json';

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe('translations', () => {
  const enKeys = keys(en).sort();

  it.each([
    ['si', si],
    ['ta', ta],
  ])('%s has exactly the English keys', (_lang, dict) => {
    expect(keys(dict).sort()).toEqual(enKeys);
  });

  it.each([
    ['si', si],
    ['ta', ta],
  ])('%s keeps every {{placeholder}}', (_lang, dict) => {
    const get = (d: Record<string, unknown>, path: string) =>
      path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d);
    for (const k of enKeys) {
      const vars = String(get(en, k)).match(/{{\w+}}/g) ?? [];
      for (const v of vars) expect(String(get(dict, k))).toContain(v);
    }
  });

  it('has no empty strings', () => {
    for (const dict of [en, si, ta]) {
      const flat = JSON.stringify(dict);
      expect(flat).not.toMatch(/:""/);
    }
  });
});

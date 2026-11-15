// Merges a section into the three locale files: node scripts/add-locale.mjs <section> <file.json>
// where file.json is { "en": {...}, "si": {...}, "ta": {...} }.
import { readFileSync, writeFileSync } from 'node:fs';

const [section, file] = process.argv.slice(2);
if (!section || !file) throw new Error('usage: add-locale.mjs <section> <file.json>');
const add = JSON.parse(readFileSync(file, 'utf8'));
for (const lang of ['en', 'si', 'ta']) {
  if (!add[lang]) throw new Error(`missing ${lang}`);
  const path = new URL(`../src/i18n/locales/${lang}.json`, import.meta.url);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  json[section] = { ...(json[section] ?? {}), ...add[lang] };
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
}

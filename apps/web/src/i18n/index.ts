import i18n, { type BackendModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readPref, writePref } from '@/lib/storage';
import en from './locales/en.json';

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'si', label: 'සිං', name: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்', name: 'தமிழ்' },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];

/** English ships in the main bundle; Sinhala and Tamil load on first use (D-037). */
export const resources = { en: { translation: en } };

const lazyLocales: BackendModule = {
  type: 'backend',
  init() {},
  read(lng, _ns, done) {
    const load =
      lng === 'si'
        ? import('./locales/si.json')
        : lng === 'ta'
          ? import('./locales/ta.json')
          : null;
    if (!load) return done(null, lng === 'en' ? en : {});
    load.then(
      (m) => done(null, m.default),
      (e: Error) => done(e, null),
    );
  },
};

const saved = readPref('lang');
const initial: LanguageCode = saved === 'si' || saved === 'ta' ? saved : 'en';

void i18n
  .use(lazyLocales)
  .use(initReactI18next)
  .init({
    resources,
    partialBundledLanguages: true,
    lng: initial,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
    // Render English while a lazy locale loads instead of suspending.
    react: { useSuspense: false },
  });

function applyLang(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
}
applyLang(initial);
i18n.on('languageChanged', (lng) => {
  writePref('lang', lng);
  applyLang(lng);
});

export default i18n;

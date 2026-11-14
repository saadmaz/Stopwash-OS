import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readPref, writePref } from '@/lib/storage';
import en from './locales/en.json';
import si from './locales/si.json';
import ta from './locales/ta.json';

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'si', label: 'සිං', name: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்', name: 'தமிழ்' },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const resources = {
  en: { translation: en },
  si: { translation: si },
  ta: { translation: ta },
};

const saved = readPref('lang');
const initial: LanguageCode = saved === 'si' || saved === 'ta' ? saved : 'en';

void i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
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

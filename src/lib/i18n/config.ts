/** Keep in sync with skia.ca `frontend/lib/i18n/config.ts`. */
export const LOCALES = [
  'fr',
  'en',
  'zh',
  'es',
  'ar',
  'pt',
  'de',
  'ja',
  'ko',
  'hi',
  'tr',
  'ru',
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';
export const LOCALE_STORAGE_KEY = 'skia-ui-locale';
export const LOCALE_COOKIE_KEY = 'skia-ui-locale';

export const LOCALE_LANGUAGE_OPTIONS: ReadonlyArray<{
  code: Locale;
  label: string;
  buttonCode: string;
}> = [
  { code: 'en', label: 'English', buttonCode: 'EN' },
  { code: 'fr', label: 'Français', buttonCode: 'FR' },
  { code: 'ar', label: 'العربية', buttonCode: 'AR' },
  { code: 'zh', label: '中文', buttonCode: '中文' },
  { code: 'es', label: 'Español', buttonCode: 'ES' },
  { code: 'de', label: 'Deutsch', buttonCode: 'DE' },
  { code: 'ja', label: '日本語', buttonCode: 'JA' },
  { code: 'ko', label: '한국어', buttonCode: 'KO' },
  { code: 'pt', label: 'Português', buttonCode: 'PT' },
  { code: 'hi', label: 'हिन्दी', buttonCode: 'HI' },
  { code: 'tr', label: 'Türkçe', buttonCode: 'TR' },
  { code: 'ru', label: 'Русский', buttonCode: 'RU' },
];

const LOCALE_SET = new Set<string>(LOCALES);

export function isLocale(value: string | undefined | null): value is Locale {
  return typeof value === 'string' && LOCALE_SET.has(value);
}

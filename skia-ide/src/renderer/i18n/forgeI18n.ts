import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from './config';

import en from './locales/en.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';
import es from './locales/es.json';
import ar from './locales/ar.json';
import pt from './locales/pt.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import hi from './locales/hi.json';
import tr from './locales/tr.json';
import ru from './locales/ru.json';

export type ForgeMessages = typeof en;

const MESSAGES: Record<Locale, ForgeMessages> = {
  en,
  fr,
  zh,
  es,
  ar,
  pt,
  de,
  ja,
  ko,
  hi,
  tr,
  ru,
};

const localeListeners = new Set<() => void>();

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

let currentLocale: Locale = readStoredLocale();

function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

applyDocumentLocale(currentLocale);

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  applyDocumentLocale(locale);
  localeListeners.forEach((fn) => fn());
}

export function subscribeLocaleChange(listener: () => void): () => void {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

function getByPath(obj: unknown, keyPath: string): unknown {
  const parts = keyPath.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Dot-path lookup with `{name}` interpolation. Falls back to English, then the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const bundle = MESSAGES[currentLocale] ?? MESSAGES.en;
  const raw = getByPath(bundle, key) ?? getByPath(MESSAGES.en, key);
  if (typeof raw !== 'string') return key;
  let value: string = raw;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.split(`{${k}}`).join(String(v));
    }
  }
  return value;
}

export function initForgeI18n(): void {
  applyDocumentLocale(currentLocale);
}

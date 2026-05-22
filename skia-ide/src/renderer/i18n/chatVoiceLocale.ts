import type { Locale } from './config';

const LOCALE_TO_VOICE_LANG: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-BR',
  de: 'de-DE',
  ar: 'ar-SA',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
  tr: 'tr-TR',
  ru: 'ru-RU',
};

export function preferredVoiceLangForLocale(locale: Locale): string {
  return LOCALE_TO_VOICE_LANG[locale] ?? 'en-US';
}

export type VoiceLike = { id: string; lang: string; name?: string };

export function pickVoiceForUiLocale<T extends VoiceLike>(
  voices: T[],
  locale: Locale,
): T | undefined {
  if (!voices.length) return undefined;

  const preferred = preferredVoiceLangForLocale(locale);
  const langCode = preferred.split('-')[0]?.toLowerCase() ?? 'en';

  const exact = voices.find((v) => v.lang.toLowerCase() === preferred.toLowerCase());
  if (exact) return exact;

  const sameLanguage = voices.find(
    (v) => v.lang.split('-')[0]?.toLowerCase() === langCode,
  );
  if (sameLanguage) return sameLanguage;

  const english =
    voices.find((v) => v.lang.toLowerCase() === 'en-us') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en-'));
  if (english) return english;

  return voices[0];
}

export function langToCountryAbbrev(langTag: string): string {
  const region = (langTag || '').split('-')[1]?.toUpperCase();
  if (!region) return 'US';
  if (region === 'GB') return 'UK';
  const known: Record<string, string> = {
    US: 'US',
    FR: 'FR',
    ES: 'ES',
    BR: 'BR',
    DE: 'DE',
    IT: 'IT',
    SA: 'SA',
    JP: 'JP',
    CN: 'CN',
    KR: 'KR',
    IN: 'IN',
    TR: 'TR',
    RU: 'RU',
    NL: 'NL',
  };
  return known[region] ?? region;
}

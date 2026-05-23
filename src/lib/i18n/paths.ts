import { DEFAULT_LOCALE, isLocale, type Locale } from './config.js';

/** Paths that must not receive locale prefix redirects/rewrites. */
export function shouldBypassLocaleRouting(pathname: string): boolean {
  if (!pathname) return true;
  if (pathname.startsWith('/api')) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/forge/app')) return true;
  if (pathname === '/favicon.ico' || pathname === '/favicon.png') return true;
  if (/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?|map|txt|md)$/i.test(pathname)) return true;
  return false;
}

export function getLocaleFromPath(path: string): Locale | null {
  const segment = path.split('/').filter(Boolean)[0];
  return isLocale(segment) ? segment : null;
}

export function stripLocalePrefix(path: string): string {
  const locale = getLocaleFromPath(path);
  if (!locale) return path.startsWith('/') ? path : `/${path}`;
  const without = path.replace(new RegExp(`^/${locale}(?=/|$)`), '') || '/';
  return without.startsWith('/') ? without : `/${without}`;
}

export function withLocalePrefix(path: string, locale: Locale): string {
  const base = stripLocalePrefix(path);
  if (base === '/') return `/${locale}`;
  return `/${locale}${base}`;
}

export function resolveLocaleFromPath(path: string): Locale {
  return getLocaleFromPath(path) ?? DEFAULT_LOCALE;
}

/** Forge web pages with collapsible sidebar — only these get locale redirects. */
export function shouldApplyForgeLocaleRouting(pathname: string): boolean {
  const internal = stripLocalePrefix(pathname);
  return (
    internal === '/platform-downloads' ||
    internal === '/resources' ||
    internal === '/security' ||
    internal === '/contact' ||
    internal.startsWith('/docs/')
  );
}

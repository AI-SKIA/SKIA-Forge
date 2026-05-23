import type { NextFunction, Request, Response } from 'express';

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  isLocale,
  type Locale,
} from '../lib/i18n/config.js';
import {
  getLocaleFromPath,
  shouldApplyForgeLocaleRouting,
  stripLocalePrefix,
  withLocalePrefix,
} from '../lib/i18n/paths.js';

const COOKIE_MAX_AGE_MS = 60 * 60 * 24 * 365 * 1000;

function parseCookieLocale(req: Request): Locale | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const match = header.match(/(?:^|; )skia-ui-locale=([^;]*)/);
  const value = match?.[1] ? decodeURIComponent(match[1].trim()) : null;
  return isLocale(value) ? value : null;
}

function setLocaleCookie(res: Response, locale: Locale): void {
  res.cookie(LOCALE_COOKIE_KEY, locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE_MS,
    sameSite: 'lax',
    httpOnly: false,
  });
}

/**
 * SKIA-controlled UI locale for Forge web pages.
 * Order: URL prefix → skia-ui-locale cookie → default "fr".
 * Does not read Accept-Language or navigator.
 */
export function forgeLocaleMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    next();
    return;
  }

  const pathname = req.path;
  if (!shouldApplyForgeLocaleRouting(pathname)) {
    next();
    return;
  }

  const pathLocale = getLocaleFromPath(pathname);

  if (pathLocale) {
    setLocaleCookie(res, pathLocale);
    const internalPath = stripLocalePrefix(pathname);
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = internalPath + query;
    next();
    return;
  }

  const locale = parseCookieLocale(req) ?? DEFAULT_LOCALE;
  const redirectPath = withLocalePrefix(pathname, locale);
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, redirectPath + query);
}

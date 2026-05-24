import type { Request } from "express";

import { resolveSkiaFullApiUrl } from "../config/localBackend.js";

export type SkiaSessionResult = {
  ok: boolean;
  status: number;
  token: string | null;
  user: unknown;
  setCookies: string[];
  error?: string;
};

export function resolveSkiaClientHeader(req: Request): string {
  const raw = req.headers["x-skia-client"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "forge-web";
}

export function extractTokenFromSessionPayload(data: Record<string, unknown>): string | null {
  const token =
    (typeof data.token === "string" && data.token) ||
    (typeof data.accessToken === "string" && data.accessToken) ||
    null;
  return token;
}

export async function fetchSkiaSessionFromRequest(
  req: Request,
  clientHeader?: string
): Promise<SkiaSessionResult> {
  const base = resolveSkiaFullApiUrl().trim().replace(/\/+$/, "");
  const target = `${base}/api/auth/session`;
  const client = clientHeader?.trim() || resolveSkiaClientHeader(req);

  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-skia-client": client,
        ...(typeof req.headers.cookie === "string" ? { cookie: req.headers.cookie } : {}),
        ...(typeof req.headers.authorization === "string"
          ? { authorization: req.headers.authorization }
          : {}),
        ...(req.ip ? { "x-forwarded-for": req.ip } : {})
      }
    });

    const setCookies: string[] =
      typeof (upstream.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (upstream.headers as { getSetCookie: () => string[] }).getSetCookie()
        : upstream.headers.get("set-cookie")
          ? [upstream.headers.get("set-cookie") as string]
          : [];

    const text = await upstream.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {
        ok: false,
        status: 502,
        token: null,
        user: null,
        setCookies,
        error: "Invalid session response from auth service"
      };
    }

    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        token: null,
        user: data.user ?? null,
        setCookies,
        error: typeof data.error === "string" ? data.error : "Unauthorized"
      };
    }

    const token = extractTokenFromSessionPayload(data);
    const user = data.user ?? null;
    if (!token && (user === null || user === undefined)) {
      return {
        ok: false,
        status: 401,
        token: null,
        user: null,
        setCookies,
        error: "Unauthorized"
      };
    }

    return { ok: true, status: 200, token, user, setCookies };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session service unavailable";
    return {
      ok: false,
      status: 500,
      token: null,
      user: null,
      setCookies: [],
      error: message
    };
  }
}

/** Only allow return targets on this Forge host (path + query, or full same-origin URL). */
export function resolveSafeReturnTo(req: Request, fallbackPath = "/forge/platform"): string {
  const raw = typeof req.query.returnTo === "string" ? req.query.returnTo.trim() : "";
  if (!raw) return fallbackPath;

  const host = req.get("host") || "localhost";
  const proto =
    req.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (req.protocol === "https" ? "https" : "http");
  const origin = `${proto}://${host}`;

  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return fallbackPath;
    return `${url.pathname}${url.search}`;
  } catch {
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return fallbackPath;
  }
}

export function localePrefixFromPath(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/|$)/);
  return match ? `/${match[1]}` : "";
}

export function buildHandoffRedirectUrl(req: Request, returnPath: string, token: string): string {
  const host = req.get("host") || "localhost";
  const proto =
    req.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (req.protocol === "https" ? "https" : "http");
  const url = new URL(returnPath, `${proto}://${host}`);
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

export function buildSkiaLoginRedirect(req: Request, returnTo: string): string {
  const prefix = localePrefixFromPath(returnTo);
  const host = req.get("host") || "localhost";
  const proto =
    req.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (req.protocol === "https" ? "https" : "http");
  const handoffUrl = `${proto}://${host}/api/auth/handoff?returnTo=${encodeURIComponent(returnTo)}`;
  return `https://skia.ca${prefix}/login?returnTo=${encodeURIComponent(handoffUrl)}`;
}

import type { NextFunction, Request, Response as ExpressResponse } from "express";
import { resolveSkiaFullApiUrl } from "../config/localBackend.js";
import { readForgeEntitlement, type ForgeEntitlementView } from "./forgeEntitlement.js";

/** A cancelled plan is visible on the next Forge request after this window. */
export const FORGE_PLAN_CACHE_TTL_MS = 60_000;

type CacheRow = { at: number; view: ForgeEntitlementView };

const cache = new Map<string, CacheRow>();

/**
 * Routes that skip the paid-plan check. Every other /api/forge route is guarded.
 * One entry per open route, with why it does not call a model.
 */
export const FORGE_OPEN_ROUTES: Array<{ method: string; path: string; reason: string }> = [
  { method: "GET", path: "/api/forge/architecture/health", reason: "Local architecture health probe; no model call." },
  { method: "GET", path: "/api/forge/architecture/graph", reason: "Local architecture graph; no model call." },
  { method: "POST", path: "/api/forge/architecture/analyze", reason: "Local graph analysis; no model call." },
  { method: "GET", path: "/api/forge/architecture/advice", reason: "Advice read from the local graph; no model call." },
  { method: "GET", path: "/api/forge/context/structure", reason: "Local workspace tree parse; no model call." },
  { method: "GET", path: "/api/forge/context/embed/stats", reason: "Local embed-store counters; no embedding call." },
  { method: "GET", path: "/api/forge/context/embed/queue", reason: "Local embed job queue metadata." },
  { method: "GET", path: "/api/forge/context/embed/jobs/:jobId", reason: "Local embed job status by id." },
  { method: "GET", path: "/api/forge/control-plane", reason: "Local control-plane snapshot; no model call." },
  { method: "GET", path: "/api/forge/sovereign-posture", reason: "Local posture flags; no model call." },
  { method: "POST", path: "/api/forge/control-plane/remediate", reason: "Local control-plane action; no model call." },
  { method: "POST", path: "/api/forge/control-plane/remediate/recommended", reason: "Local recommended remediation; no model call." },
  { method: "POST", path: "/api/forge/governance/reload", reason: "Reloads local governance config; no model call." },
  { method: "GET", path: "/api/forge/mode", reason: "Reads the local Forge mode flag." },
  { method: "POST", path: "/api/forge/mode", reason: "Writes the local Forge mode flag." },
  { method: "GET", path: "/api/forge/governance", reason: "Reads local governance state." },
  { method: "GET", path: "/api/forge/lockdown", reason: "Reads the local lockdown flag." },
  { method: "POST", path: "/api/forge/lockdown", reason: "Writes the local lockdown flag." },
  { method: "POST", path: "/api/forge/approval-token", reason: "Mints a local approval token; no model call." },
  { method: "GET", path: "/api/forge/approval-token/stats", reason: "Local approval-token counters." },
  { method: "GET", path: "/api/forge/governance/intents/status", reason: "Local intent status; no model call." },
  { method: "GET", path: "/api/forge/governance/telemetry", reason: "Local governance telemetry." },
  { method: "POST", path: "/api/forge/module/:module/preview", reason: "Preview only; does not run the module." },
  { method: "POST", path: "/api/forge/orchestrate/preview", reason: "Preview only; does not run orchestration." },
  { method: "POST", path: "/api/forge/skia-review", reason: "Local repo scan and health score; no model call." },
  { method: "GET", path: "/api/forge/production/status", reason: "Local production status." },
  { method: "GET", path: "/api/forge/production/health", reason: "Local production health." },
  { method: "GET", path: "/api/forge/production/telemetry", reason: "Local production telemetry." },
  { method: "POST", path: "/api/forge/healing/scan", reason: "Local healing scan; no model call." },
  { method: "POST", path: "/api/forge/healing/remediate", reason: "Local healing executor; no model call." },
  { method: "GET", path: "/api/forge/healing/history", reason: "Local healing history." },
  { method: "POST", path: "/api/forge/self/improve", reason: "Local self-improvement cycle; no Skia model adapter." },
  { method: "GET", path: "/api/forge/agents/status", reason: "In-memory agent coordinator status." },
  { method: "POST", path: "/api/forge/agents/spawn", reason: "In-memory agent spawn; no model call." },
  { method: "POST", path: "/api/forge/agents/coordinate", reason: "In-memory agent coordination; no model call." }
];

export function resetForgePlanCacheForTests(): void {
  cache.clear();
}

export function isForgeOpenRoute(method: string, path: string): boolean {
  const normalized = path.split("?")[0].replace(/\/+$/, "") || "/";
  const methodUpper = method.toUpperCase();
  return FORGE_OPEN_ROUTES.some((entry) => {
    if (entry.method !== methodUpper) return false;
    const pattern = `^${entry.path.replace(/:[^/]+/g, "[^/]+")}$`;
    return new RegExp(pattern).test(normalized);
  });
}

/** True when the route is under /api/forge and is not on FORGE_OPEN_ROUTES. */
export function isPaidForgeRequest(method: string, path: string): boolean {
  const normalized = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (!normalized.startsWith("/api/forge")) return false;
  return !isForgeOpenRoute(method, normalized);
}

function requestPath(req: Request): string {
  if (req.originalUrl) {
    const path = req.originalUrl.split("?")[0];
    if (path.startsWith("/api/forge")) return path;
  }
  const joined = `${req.baseUrl || ""}${req.path || ""}`;
  return joined.split("?")[0];
}

function bearerToken(req: Request): string {
  const raw = req.headers.authorization;
  if (typeof raw !== "string") return "";
  const match = raw.match(/^Bearer\s+(\S+)/i);
  return match?.[1]?.trim() ?? "";
}

export async function loadForgeEntitlementForToken(
  token: string,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
  apiBase = resolveSkiaFullApiUrl()
): Promise<{ status: number; view: ForgeEntitlementView | null }> {
  const hit = cache.get(token);
  if (hit && now - hit.at <= FORGE_PLAN_CACHE_TTL_MS) {
    return { status: 200, view: hit.view };
  }

  const base = apiBase.replace(/\/+$/, "");
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetchImpl(`${base}/api/auth/session`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-skia-client": "forge-desktop",
        "content-type": "application/json"
      }
    });
  } catch {
    return { status: 503, view: null };
  }

  if (response.status === 401) return { status: 401, view: null };
  if (!response.ok) return { status: 503, view: null };

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { status: 503, view: null };
  }

  const view =
    readForgeEntitlement(data) ??
    ({
      entitled: false,
      planId: "free",
      reasonCode: "PLAN_REQUIRED",
      expiresAt: null
    } satisfies ForgeEntitlementView);
  cache.set(token, { at: now, view });
  return { status: 200, view };
}

export function requirePaidForgePlan(req: Request, res: ExpressResponse, next: NextFunction): void {
  if (isForgeOpenRoute(req.method, requestPath(req))) {
    next();
    return;
  }
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  void loadForgeEntitlementForToken(token)
    .then((result) => {
      if (result.status === 401) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (result.status !== 200 || !result.view) {
        res.status(503).json({ error: "Entitlement service unavailable" });
        return;
      }
      if (!result.view.entitled) {
        res.status(403).json({
          error: "FORGE_PLAN_REQUIRED",
          reasonCode: result.view.reasonCode,
          forgeEntitlement: result.view
        });
        return;
      }
      next();
    })
    .catch(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: "Entitlement service unavailable" });
      }
    });
}

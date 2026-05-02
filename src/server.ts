import path from "node:path";
import fs from "node:fs/promises";
import http from "node:http";
import express from "express";
import { appendAuditLog, readAuditLog } from "./auditLog.js";
import { ContextEngine } from "./contextEngine.js";
import { loadSkiaRules } from "./rules.js";
import { handleRpcRequest, streamSkiaMethod } from "./rpc.js";
import { ProviderRouter } from "./providerRouter.js";
import { renderChatHtml } from "./chatUi.js";
import { attachInlineCompletionServer } from "./inlineCompletion.js";
import { SkiaStatus } from "./types.js";
import { TelemetryStore } from "./telemetry.js";
import { evaluateCommandSafety } from "./agentSafety.js";
import {
  controlPlaneRemediationSchema,
  embedIndexRequestSchema,
  embedSearchRequestSchema,
  forgeContextRetrievalRequestSchema,
  forgeAgentPlanRequestSchema,
  providerForceSchema,
  providerHealthSchema,
  sovereignModeSchema,
  telemetryRecordSchema,
  validateCommandSchema
} from "./contracts.js";
import { buildLiveness, buildReadiness } from "./operational.js";
import { loadRuntimeState, persistRuntimeState } from "./stateStore.js";
import { attachRequestContext, buildRequestLog, RequestWithContext } from "./requestContext.js";
import { enforceTextSize, RateLimiter, rateLimitMiddleware } from "./guardrails.js";
import { SkiaFullAdapter } from "./skiaFullAdapter.js";
import { buildProbeReport } from "./integrationReport.js";
import { runForgeOrchestration } from "./forgeOrchestrator.js";
import { renderForgePlatformHtml } from "./forgePlatformUi.js";

/** Canonical download / marketing UI lives in Skia-FULL (`frontend/pages/platform-downloads.tsx`). */
const SKIA_PLATFORM_DOWNLOADS_URL = "https://skia.ca/platform-downloads";
import { renderOgImageSvg } from "./ogImage.js";
import { buildForgeModuleHealth } from "./forgeModuleHealth.js";
import { ForgeModuleName, isForgeModuleName, runForgeModule } from "./forgeModuleExecutor.js";
import { evaluateForgeModuleAccess, SovereignExecutionMode } from "./forgeGovernance.js";
import { buildGovernancePolicy, ForgeGovernancePolicy } from "./forgePolicy.js";
import { buildGovernanceAuditRecord } from "./forgeGovernanceAudit.js";
import { GovernanceTelemetryStore } from "./governanceTelemetry.js";
import { previewModuleDecision, previewOrchestrationDecisions } from "./forgeExecutionPreview.js";
import { resolveModeAndApproval } from "./forgeGovernanceResolver.js";
import { buildControlPlaneSnapshot } from "./forgeControlPlane.js";
import {
  executeControlPlaneRemediation,
  executeRecommendedRemediations
} from "./forgeControlPlaneRemediation.js";
import { ApprovalTokenPurpose, ApprovalTokenStore } from "./approvalTokens.js";
import { IntentSignatureVerifier, SensitiveIntentName } from "./intentSignature.js";
import { buildSovereignPosture } from "./sovereignPosture.js";
import { runForgeContextStructure } from "./forge/modules/context-engine/contextStructureRequest.js";
import { runForgeContextSemanticChunks } from "./forge/modules/context-engine/semanticChunksRequest.js";
import { runEmbedIndexRequest } from "./forge/modules/context-engine/embedIndexRequest.js";
import { runEmbedSearchRequest } from "./forge/modules/context-engine/embedSearchRequest.js";
import { runForgeContextRetrieval } from "./forge/modules/context-engine/contextRetrievalRequest.js";
import { runAgentPlannerRequest } from "./forge/modules/agent-planner/agentPlannerRequest.js";
import { runAgentExecutorRequest } from "./forge/modules/agent-executor/agentExecutorRequest.js";
import { ProductionAdapterV1, createProductionRouter } from "./forge/modules/production/index.js";
import { HealingExecutorV1, createHealingRouter } from "./forge/modules/healing/index.js";
import { createArchitectureRouter } from "./forge/modules/architecture/index.js";
import { health_score, hotspots, trend } from "./forge/modules/skiarules/architectureDiagnostics.js";
import { securityAnalysisService } from "./forge/modules/security/SecurityAnalysisService.js";
import { getEmbedIndexQueue } from "./forge/modules/context-engine/embedIndexQueue.js";
import { createEmbedIncrementalOnSaveHandler } from "./forge/modules/context-engine/embedIncrementalOnSave.js";
import { createEmbeddingVectorStore } from "./forge/modules/context-engine/embeddingVectorStoreFactory.js";
import { SKIA_FULL_EMBEDDING_PATH_DEFAULT } from "./skiaFullEmbeddingContract.js";

const app = express();
app.use(attachRequestContext);
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.on("finish", () => {
    const row = buildRequestLog(req as RequestWithContext, res);
    console.log(JSON.stringify({ level: "info", event: "http.request", ...row }));
  });
  next();
});

const projectRoot = process.env.SKIA_PROJECT_ROOT
  ? path.resolve(process.env.SKIA_PROJECT_ROOT)
  : process.cwd();
const contextEngine = new ContextEngine(projectRoot);
const providerRouter = new ProviderRouter();
const telemetry = new TelemetryStore();
const skiaFullAdapter = new SkiaFullAdapter({
  enabled: String(process.env.SKIA_FULL_ENABLED ?? "true") !== "false",
  baseUrl: process.env.SKIA_FULL_API_URL ?? "https://api.skia.ca",
  timeoutMs: Number(process.env.SKIA_FULL_TIMEOUT_MS ?? 15000),
  allowLocalFallback: String(process.env.SKIA_FULL_ALLOW_LOCAL_FALLBACK ?? "false") === "true",
  brainOnly: true,
  authBearer: process.env.SKIA_FULL_AUTH_BEARER,
  apiKey: process.env.SKIA_FULL_API_KEY,
  embeddingPath: process.env.SKIA_FULL_EMBEDDING_PATH ?? SKIA_FULL_EMBEDDING_PATH_DEFAULT,
  embedModel: process.env.SKIA_FULL_EMBED_MODEL
});
const embedIndexQueue = getEmbedIndexQueue(projectRoot, process.env);
function isEmbedIncrementalOnSaveEnabled(): boolean {
  const v = (process.env.EMBED_INCREMENTAL_ON_SAVE ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
const embedSaveHook = isEmbedIncrementalOnSaveEnabled()
  ? createEmbedIncrementalOnSaveHandler({
      projectRoot,
      env: process.env,
      skia: skiaFullAdapter,
      queue: embedIndexQueue,
      isPathIgnored: (rel) => contextEngine.isPathIgnoredByProjectRules(rel)
    })
  : undefined;
const rpcLimiter = new RateLimiter(40, 60_000);
const streamLimiter = new RateLimiter(30, 60_000);
const productionAdapter = new ProductionAdapterV1({ apiUrl: process.env.PRODUCTION_API_URL });
const healingExecutor = new HealingExecutorV1(projectRoot);
const approvalTokens = new ApprovalTokenStore(5 * 60_000);
const secondaryGraceUntilMs = Number(process.env.SKIA_INTENT_SIGNING_PREVIOUS_GRACE_UNTIL_MS ?? "");
const intentVerifier = new IntentSignatureVerifier({
  primaryKey: process.env.SKIA_INTENT_SIGNING_KEY,
  secondaryKey: process.env.SKIA_INTENT_SIGNING_PREVIOUS_KEY,
  secondaryGraceUntilMs: Number.isFinite(secondaryGraceUntilMs) ? secondaryGraceUntilMs : null
});
let skiaStatus: SkiaStatus = providerRouter.getStatus();
let sovereignMode: SovereignExecutionMode = "adaptive";
let governanceLockdown = false;
let governancePolicy: ForgeGovernancePolicy = buildGovernancePolicy({});
const governanceTelemetry = new GovernanceTelemetryStore();
const runtimeState = {
  startedAt: Date.now(),
  ready: false,
  shuttingDown: false
};
type ReleaseVersionCache = {
  atMs: number;
  latestVersion: string | null;
};
let releaseVersionCache: ReleaseVersionCache = { atMs: 0, latestVersion: null };
type ReleaseAssetsCache = {
  atMs: number;
  latestVersion: string | null;
  files: string[];
  assets: Array<{ name: string; url: string }>;
};
let releaseAssetsCache: ReleaseAssetsCache = { atMs: 0, latestVersion: null, files: [], assets: [] };
type DownloadPlatformId = "windows" | "mac-intel" | "mac-arm" | "linux-appimage";
const RELEASE_REPO = (process.env.SKIA_FORGE_RELEASE_REPO ?? "AI-SKIA/SKIA-Forge").trim();
const RELEASE_TAG = (process.env.SKIA_FORGE_RELEASE_TAG ?? "v1.0.0").trim();

function githubApiHeaders(): Record<string, string> {
  const token = (process.env.GITHUB_TOKEN ?? process.env.SKIA_GITHUB_TOKEN ?? "").trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skia-forge-release-assets"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function normalizeSemver(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function compareSemver(aRaw: string, bRaw: string): number {
  const a = normalizeSemver(aRaw).split(".").map((part) => Number(part.replace(/\D.*/, "")) || 0);
  const b = normalizeSemver(bRaw).split(".").map((part) => Number(part.replace(/\D.*/, "")) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

async function fetchLatestForgeReleaseTag(timeoutMs = 3000): Promise<string | null> {
  const now = Date.now();
  if (now - releaseVersionCache.atMs < 300_000) {
    return releaseVersionCache.latestVersion;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
      headers: {
        ...githubApiHeaders(),
        "User-Agent": "skia-forge-version-check"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      releaseVersionCache = { atMs: now, latestVersion: null };
      return null;
    }
    const payload = (await response.json()) as { tag_name?: unknown };
    const tag = typeof payload.tag_name === "string" ? payload.tag_name.trim() : "";
    const latest = tag || null;
    releaseVersionCache = { atMs: now, latestVersion: latest };
    return latest;
  } catch {
    releaseVersionCache = { atMs: now, latestVersion: null };
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchReleaseAssetsFromRecentReleases(
  timeoutMs: number
): Promise<Array<{ name: string; url: string }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=25`,
      { headers: githubApiHeaders(), signal: controller.signal }
    );
    if (!response.ok) {
      return [];
    }
    const list = (await response.json()) as Array<{
      assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
    }>;
    const merged: Array<{ name: string; url: string }> = [];
    const seen = new Set<string>();
    for (const rel of Array.isArray(list) ? list : []) {
      const rowAssets = Array.isArray(rel.assets) ? rel.assets : [];
      for (const asset of rowAssets) {
        const name = typeof asset.name === "string" ? asset.name.trim() : "";
        const url = typeof asset.browser_download_url === "string" ? asset.browser_download_url.trim() : "";
        if (name && url && !seen.has(name)) {
          seen.add(name);
          merged.push({ name, url });
        }
      }
    }
    return merged;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLatestForgeReleaseAssets(
  timeoutMs = 4000
): Promise<{ latestVersion: string | null; files: string[]; assets: Array<{ name: string; url: string }> }> {
  const now = Date.now();
  if (now - releaseAssetsCache.atMs < 300_000) {
    return {
      latestVersion: releaseAssetsCache.latestVersion,
      files: releaseAssetsCache.files,
      assets: releaseAssetsCache.assets
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
      headers: githubApiHeaders(),
      signal: controller.signal
    });
    if (!response.ok) {
      releaseAssetsCache = { atMs: now, latestVersion: null, files: [], assets: [] };
      return { latestVersion: null, files: [], assets: [] };
    }
    const payload = (await response.json()) as {
      tag_name?: unknown;
      assets?: Array<{ name?: unknown; browser_download_url?: unknown }>;
    };
    const latestVersion = typeof payload.tag_name === "string" && payload.tag_name.trim()
      ? payload.tag_name.trim()
      : null;
    let assets = Array.isArray(payload.assets)
      ? payload.assets
          .map((asset) => ({
            name: typeof asset.name === "string" ? asset.name.trim() : "",
            url: typeof asset.browser_download_url === "string" ? asset.browser_download_url.trim() : ""
          }))
          .filter((asset) => Boolean(asset.name) && Boolean(asset.url))
      : [];
    if (assets.length === 0) {
      const merged = await fetchReleaseAssetsFromRecentReleases(timeoutMs);
      if (merged.length > 0) {
        assets = merged;
      }
    }
    const files = assets.map((asset) => asset.name);
    releaseAssetsCache = { atMs: now, latestVersion, files, assets };
    return { latestVersion, files, assets };
  } catch {
    releaseAssetsCache = { atMs: now, latestVersion: null, files: [], assets: [] };
    return { latestVersion: null, files: [], assets: [] };
  } finally {
    clearTimeout(timeout);
  }
}

function pickReleaseAssetUrlForPlatform(
  platform: DownloadPlatformId,
  assets: Array<{ name: string; url: string }>
): string | null {
  const isArmMac = (name: string) => /(arm64|aarch64|apple[-_. ]?silicon|m1|m2|m3)/i.test(name);
  const byName = (predicate: (name: string) => boolean): string | null => {
    const hit = assets.find((asset) => predicate(asset.name));
    return hit?.url ?? null;
  };

  if (platform === "windows") {
    const setupExe = assets.find(
      (a) => /\.exe$/i.test(a.name) && /(setup|nsis|installer|forge)/i.test(a.name)
    );
    if (setupExe) {
      return setupExe.url;
    }
    const exeHit = byName((name) => /\.exe$/i.test(name));
    if (exeHit) {
      return exeHit;
    }
    const msiHit = byName((name) => /\.msi$/i.test(name));
    if (msiHit) {
      return msiHit;
    }
    const anyInstaller = assets.find((a) => /\.(exe|msi)$/i.test(a.name));
    if (anyInstaller) {
      return anyInstaller.url;
    }
    const loose = assets.find(
      (a) =>
        /(win|windows|nsis|setup|x64|amd64)/i.test(a.name) && !/\.(dmg|appimage|zip|tar)/i.test(a.name)
    );
    return loose?.url ?? null;
  }
  if (platform === "mac-arm") {
    return byName((name) => /\.dmg$/i.test(name) && isArmMac(name));
  }
  if (platform === "mac-intel") {
    return (
      byName((name) => /\.dmg$/i.test(name) && /(intel|x64|amd64)/i.test(name)) ??
      byName((name) => /\.dmg$/i.test(name) && !isArmMac(name))
    );
  }
  if (platform === "linux-appimage") {
    return byName((name) => /\.appimage$/i.test(name));
  }
  return null;
}

function fallbackReleaseAssetUrl(platform: DownloadPlatformId): string {
  const fileByPlatform: Record<DownloadPlatformId, string> = {
    windows: "SKIA-FORGE-Setup-1.0.0-win-x64.exe",
    "mac-intel": "Skia-Forge-1.0.0-mac-x64.dmg",
    "mac-arm": "Skia-Forge-1.0.0-mac-arm64.dmg",
    "linux-appimage": "Skia-Forge-1.0.0-linux-x64.AppImage"
  };
  const file = fileByPlatform[platform];
  return `https://github.com/${RELEASE_REPO}/releases/download/${RELEASE_TAG}/${encodeURIComponent(file)}`;
}

async function canDownloadFromUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) {
      return false;
    }
    try {
      await response.body?.cancel();
    } catch {
      // ignore cancel errors
    }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function persistAllState(): void {
  void persistRuntimeState(projectRoot, providerRouter, telemetry, {
    getMode: () => sovereignMode,
    getLockdown: () => governanceLockdown,
    governanceTelemetry
  });
}

const incrementalWatcherEnabled =
  process.env.SKIA_ENABLE_WATCHER === "1" || process.env.NODE_ENV !== "production";
if (incrementalWatcherEnabled) {
  void contextEngine.startIncrementalWatcher(
    () => {
      skiaStatus = providerRouter.getStatus();
    },
    embedSaveHook
  );
}

void loadSkiaRules(projectRoot)
  .then(async (rules) => {
    governancePolicy = buildGovernancePolicy(rules);
    sovereignMode = governancePolicy.defaultMode;
    await loadRuntimeState(projectRoot, providerRouter, telemetry, {
      setMode: (mode) => {
        sovereignMode = mode;
      },
      setLockdown: (enabled) => {
        governanceLockdown = enabled;
      },
      governanceTelemetry
    });
    skiaStatus = providerRouter.getStatus();
  })
  .catch(async () => {
    // Keep defaults if rules are unavailable.
    await loadRuntimeState(projectRoot, providerRouter, telemetry, {
      setMode: (mode) => {
        sovereignMode = mode;
      },
      setLockdown: (enabled) => {
        governanceLockdown = enabled;
      },
      governanceTelemetry
    });
    skiaStatus = providerRouter.getStatus();
  });

void contextEngine
  .buildIndex()
  .then(() => {
    runtimeState.ready = true;
  })
  .catch(() => {
    runtimeState.ready = false;
  });

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "skia-intelligence",
    projectRoot,
    timestamp: new Date().toISOString()
  });
});

app.get("/live", (_req, res) => {
  res.json(
    buildLiveness({
      ...runtimeState,
      skiaStatus
    })
  );
});

app.get("/ready", (_req, res) => {
  const readiness = buildReadiness({
    ...runtimeState,
    skiaStatus
  });
  if (!readiness.ready) {
    return res.status(503).json(readiness);
  }
  return res.json(readiness);
});

app.get("/version", (_req, res) => {
  res.json({
    service: "skia-intelligence",
    version: process.env.npm_package_version ?? "0.0.0-dev"
  });
});

app.get("/api/app/version-check", async (_req, res) => {
  const currentVersion = process.env.npm_package_version ?? "0.0.0-dev";
  const latestFromEnv = (process.env.SKIA_FORGE_LATEST_VERSION ?? "").trim();
  const latestVersion = latestFromEnv || (await fetchLatestForgeReleaseTag()) || null;
  const updateAvailable =
    latestVersion != null &&
    compareSemver(normalizeSemver(latestVersion), normalizeSemver(currentVersion)) > 0;

  res.json({
    app: "skia-forge",
    currentVersion,
    latestVersion,
    updateAvailable,
    source: latestFromEnv ? "env" : "github"
  });
});

app.get("/api/app/release-assets", async (_req, res) => {
  const latestFromEnv = (process.env.SKIA_FORGE_LATEST_VERSION ?? "").trim() || null;
  const { latestVersion, files, assets } = await fetchLatestForgeReleaseAssets();
  res.json({
    app: "skia-forge",
    latestVersion: latestFromEnv || latestVersion,
    files,
    assets,
    source: latestFromEnv ? "env+github-assets" : "github"
  });
});

async function proxyAuthToSkia(
  req: express.Request,
  res: express.Response,
  method: "GET" | "POST",
  pathSuffix: string
): Promise<void> {
  const base = (process.env.SKIA_BACKEND_URL ?? "https://api.skia.ca").trim().replace(/\/+$/, "");
  const target = `${base}${pathSuffix}`;
  try {
    const upstream = await fetch(target, {
      method,
      headers: {
        "content-type": "application/json",
        ...(typeof req.headers.cookie === "string" ? { cookie: req.headers.cookie } : {}),
        ...(typeof req.headers.authorization === "string"
          ? { authorization: req.headers.authorization }
          : {})
      },
      body: method === "POST" ? JSON.stringify(req.body ?? {}) : undefined
    });
    const text = await upstream.text();
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) {
      res.setHeader("set-cookie", setCookie);
    }
    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      res.setHeader("content-type", contentType);
    }
    res.status(upstream.status).send(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth proxy failed";
    res.status(502).json({ error: message });
  }
}

app.post("/api/auth/login", async (req, res) => {
  await proxyAuthToSkia(req, res, "POST", "/api/auth/login");
});

app.post("/api/auth/register", async (req, res) => {
  await proxyAuthToSkia(req, res, "POST", "/api/auth/register");
});

app.get("/api/auth/session", async (req, res) => {
  await proxyAuthToSkia(req, res, "GET", "/api/auth/session");
});

app.get("/api/app/download/:platform", async (req, res) => {
  const platform = String(req.params.platform ?? "").toLowerCase() as DownloadPlatformId;
  if (!["windows", "mac-intel", "mac-arm", "linux-appimage"].includes(platform)) {
    return res.status(400).json({ error: "Unsupported platform." });
  }

  const { assets } = await fetchLatestForgeReleaseAssets();
  const directUrl = pickReleaseAssetUrlForPlatform(platform, assets);
  if (directUrl) {
    return res.redirect(302, directUrl);
  }
  const fallbackUrl = fallbackReleaseAssetUrl(platform);
  if (await canDownloadFromUrl(fallbackUrl)) {
    return res.redirect(302, fallbackUrl);
  }

  return res
    .status(503)
    .type("html")
    .send(`<!doctype html><html><body style="font-family:Arial;background:#080400;color:#d4af37;padding:24px">
      <h2 style="margin-top:0">Forge installer unavailable</h2>
      <p>The ${platform} desktop installer is not published yet for this release.</p>
      <p><a href="/forge/app/?resetOnboarding=1" style="color:#d4af37">Open Forge Web IDE</a></p>
    </body></html>`);
});

app.get("/api/app/download", (req, res) => {
  const ua = String(req.headers["user-agent"] ?? "").toLowerCase();
  const platform: DownloadPlatformId =
    ua.includes("windows")
      ? "windows"
      : ua.includes("mac os") || ua.includes("macintosh")
        ? ua.includes("arm") || ua.includes("apple silicon") ? "mac-arm" : "mac-intel"
        : "linux-appimage";
  return res.redirect(302, `/api/app/download/${platform}`);
});

app.get("/state/runtime", (_req, res) => {
  res.json({
    provider: providerRouter.toSnapshot(),
    telemetry: telemetry.toSnapshot()
  });
});

app.get("/integration/skia-full", (_req, res) => {
  res.json({
    ...skiaFullAdapter.getStatus(),
    intelligenceContracts: {
      primaryChat: "/api/skia/chat",
      reasoningRouter: "/api/meta/route",
      routingEstimate: "/api/routing/estimate",
      search: "/api/skia/search"
    }
  });
});

app.get("/integration/skia-full/probe", async (_req, res) => {
  try {
    const rows = await skiaFullAdapter.probeBrainContracts(pickSkiaHeaders(_req));
    const okCount = rows.filter((r) => r.ok).length;
    const reachableCount = rows.filter((r) => r.reachable).length;
    res.json({
      adapter: skiaFullAdapter.getStatus(),
      summary: {
        total: rows.length,
        reachableCount,
        okCount
      },
      rows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Probe failed";
    res.status(500).json({ error: message });
  }
});

app.get("/integration/skia-full/probe/report", async (req, res) => {
  try {
    const rows = await skiaFullAdapter.probeBrainContracts(pickSkiaHeaders(req));
    const report = buildProbeReport(rows);
    res.json({
      adapter: skiaFullAdapter.getStatus(),
      ...report
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Probe report failed";
    res.status(500).json({ error: message });
  }
});

app.get("/api/forge/modules/status", async (req, res) => {
  try {
    const rows = await skiaFullAdapter.probeBrainContracts(pickSkiaHeaders(req));
    const modules = buildForgeModuleHealth(rows);
    res.json({
      updatedAt: new Date().toISOString(),
      modules
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge module status failed";
    res.status(502).json({ error: message });
  }
});

app.get("/api/forge/architecture/health", async (_req, res) => {
  const score = health_score(projectRoot);
  const hotspotRows = hotspots(projectRoot);
  const healthTrend = await trend(projectRoot, 14);
  return res.json({
    ...score,
    hotspots: hotspotRows,
    trend: healthTrend
  });
});

app.post("/api/forge/skia-review", async (req, res) => {
  try {
    const message = String(req.body?.message ?? req.body?.query ?? "Run full SKIA review.");
    const [arch, archHotspots, sec] = await Promise.all([
      Promise.resolve(health_score(projectRoot)),
      Promise.resolve(hotspots(projectRoot)),
      securityAnalysisService.scan_repo(projectRoot)
    ]);
    return res.json({
      command: "/skia-review",
      message,
      architecture: arch,
      hotspots: archHotspots,
      security: {
        totalFiles: sec.totalFiles,
        highFindings: sec.findings.filter((x) => x.severity === "high").length,
        findings: sec.findings.slice(0, 20)
      },
      recommendation:
        sec.findings.some((x) => x.severity === "high") || arch.overall < 70
          ? "Block high-risk changes until architecture and security issues are resolved."
          : "Proceed with guarded apply mode and targeted tests."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "skia-review failed";
    return res.status(500).json({ error: message });
  }
});

app.use("/api/forge/production", createProductionRouter(projectRoot, productionAdapter));
app.use(
  "/api/forge/healing",
  createHealingRouter(productionAdapter, healingExecutor, {
    getMode: () => sovereignMode,
    isLockdown: () => governanceLockdown
  })
);
app.use(
  "/api/forge/architecture",
  createArchitectureRouter({
    projectRoot,
    getStructurePaths: () => contextEngine.getStructureIndexSummary().paths,
    getDiagnosticsForPath: (relPath) => contextEngine.getDiagnosticsForPath(relPath)
  })
);

app.get("/api/forge/mode", (_req, res) => {
  res.json({ mode: sovereignMode, policyDefaultMode: governancePolicy.defaultMode });
});

app.post("/api/forge/mode", async (req, res) => {
  if (!verifySensitiveIntent(req, res, "forge.mode.set")) return;
  const parsed = sovereignModeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid sovereign mode payload." });
  }
  sovereignMode = parsed.data.mode;
  await appendAuditLog(
    projectRoot,
    buildGovernanceAuditRecord({
      action: "forge.mode.set",
      mode: sovereignMode,
      approved: true,
      result: "success",
      details: "Sovereign mode updated."
    })
  );
  persistAllState();
  return res.json({ ok: true, mode: sovereignMode });
});

app.get("/api/forge/governance", (_req, res) => {
  res.json({
    mode: sovereignMode,
    lockdown: governanceLockdown,
    policy: governancePolicy
  });
});

app.get("/api/forge/lockdown", (_req, res) => {
  res.json({ enabled: governanceLockdown });
});

app.post("/api/forge/lockdown", async (req, res) => {
  if (!verifySensitiveIntent(req, res, "forge.lockdown.toggle")) return;
  const enabled = req.body?.enabled === true;
  const approvedViaToken =
    typeof req.body?.approvalToken === "string"
      ? approvalTokens.consume(req.body.approvalToken, "remediation")
      : false;
  const approved = req.body?.approved === true || approvedViaToken;
  if (!approved) {
    return res.status(403).json({ status: "blocked", error: "Lockdown toggle requires approval." });
  }
  governanceLockdown = enabled;
  await appendAuditLog(
    projectRoot,
    buildGovernanceAuditRecord({
      action: "forge.control_plane.remediate",
      mode: sovereignMode,
      approved: true,
      result: "success",
      details: `lockdown=${String(enabled)}`
    })
  );
  persistAllState();
  return res.json({ ok: true, enabled: governanceLockdown });
});

app.post("/api/forge/approval-token", async (_req, res) => {
  if (!verifySensitiveIntent(_req, res, "forge.approval_token.issue")) return;
  const payload =
    typeof _req.body === "object" && _req.body ? (_req.body as Record<string, unknown>) : {};
  const purposeCandidate = typeof payload.purpose === "string" ? payload.purpose : "any";
  const purpose: ApprovalTokenPurpose =
    purposeCandidate === "module" ||
    purposeCandidate === "orchestration" ||
    purposeCandidate === "remediation" ||
    purposeCandidate === "any"
      ? purposeCandidate
      : "any";
  const issued = approvalTokens.issue(purpose);
  await appendAuditLog(
    projectRoot,
    buildGovernanceAuditRecord({
      action: "forge.control_plane.remediate",
      mode: sovereignMode,
      approved: true,
      result: "success",
      details: "Ephemeral approval token issued."
    })
  );
  res.json({ ok: true, ...issued });
});

app.get("/api/forge/approval-token/stats", (_req, res) => {
  res.json({
    updatedAt: new Date().toISOString(),
    ...approvalTokens.getStats()
  });
});

app.get("/api/forge/governance/intents/status", (_req, res) => {
  res.json({
    updatedAt: new Date().toISOString(),
    ...intentVerifier.getStatus()
  });
});

app.get("/api/forge/governance/telemetry", (_req, res) => {
  res.json({
    updatedAt: new Date().toISOString(),
    ...governanceTelemetry.getSummary()
  });
});

/**
 * Build plan D1-01: structural parse for a project file (TypeScript via compiler; JS via Tree-sitter).
 * Query: ?path=relative/path/to/file.ts
 * Success: 200. Unsupported extension: 422 (see `forgeContextStructureOkBodySchema` in contracts).
 */
app.get("/api/forge/context/structure", async (req, res) => {
  const { status, body } = await runForgeContextStructure(
    projectRoot,
    String(req.query.path ?? ""),
    (p) => fs.readFile(p, "utf8")
  );
  return res.status(status).json(body);
});

/**
 * D1-02: Semantic chunks from D1-01 structure. Query: ?path= & optional embed=1 to probe
 * `SkiaFullAdapter.tryEmbedding` against `/api/skia/embedding` (upstream may 404).
 */
app.get("/api/forge/context/semantic-chunks", async (req, res) => {
  const tryEmbed = String(req.query.embed ?? "") === "1" || String(req.query.embed) === "true";
  const { status, body } = await runForgeContextSemanticChunks(
    projectRoot,
    String(req.query.path ?? ""),
    (p) => fs.readFile(p, "utf8"),
    skiaFullAdapter,
    tryEmbed
  );
  return res.status(status).json(body);
});

app.get("/api/forge/context/embed/stats", async (_req, res) => {
  const store = createEmbeddingVectorStore(projectRoot, process.env);
  res.json({
    backend: (process.env.EMBED_VECTOR_STORE ?? "file").toLowerCase(),
    ...(await store.getStats())
  });
});

app.post("/api/forge/context/embed/index", async (req, res) => {
  const parsed = embedIndexRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body: { path? | paths?: string[], minDelayMs?, async? }" });
  }
  const { status, result } = await runEmbedIndexRequest(
    projectRoot,
    parsed.data,
    skiaFullAdapter,
    embedIndexQueue,
    process.env
  );
  return res.status(status).json(result);
});

app.get("/api/forge/context/embed/queue", (_req, res) => {
  res.json({ ...embedIndexQueue.getConfig(), depth: embedIndexQueue.getQueueDepth() });
});

app.get("/api/forge/context/embed/jobs/:jobId", (req, res) => {
  const j = embedIndexQueue.getJob(String(req.params.jobId ?? ""));
  if (!j) {
    return res.status(404).json({ error: "Unknown job id." });
  }
  return res.json(j);
});

app.post("/api/forge/context/embed/search", async (req, res) => {
  const parsed = embedSearchRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body: { query, topK?, nprobes?, refineFactor?, where?, bypassVectorIndex? }" });
  }
  const { status, result } = await runEmbedSearchRequest(
    projectRoot,
    parsed.data,
    skiaFullAdapter,
    process.env
  );
  return res.status(status).json(result);
});

app.post("/api/forge/context/retrieve", async (req, res) => {
  const parsed = forgeContextRetrievalRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({
        error:
          "Invalid body: { path, query?, maxTokens?, topK?, nprobes?, refineFactor?, where?, bypassVectorIndex? }"
      });
  }
  const { status, body } = await runForgeContextRetrieval(
    projectRoot,
    parsed.data,
    skiaFullAdapter,
    process.env,
    contextEngine,
    {
      getSkiarulesConfig: () => contextEngine.getSkiarulesConfig(),
      getDiagnosticsForPath: (rel) => contextEngine.getDiagnosticsForPath(rel),
      getLspSkiarulesBundleForPath: (rel) => contextEngine.getLspSkiarulesBundleForPath(rel)
    }
  );
  return res.status(status).json(body);
});

app.get("/api/forge/control-plane", async (_req, res) => {
  try {
    const rows = await readAuditLog(projectRoot);
    res.json(
      buildControlPlaneSnapshot({
        mode: sovereignMode,
        lockdown: governanceLockdown,
        policy: governancePolicy,
        telemetry: governanceTelemetry.getSummary(),
        approvalTokens: approvalTokens.getStats(),
        intents: intentVerifier.getStatus(),
        auditRows: rows
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Control plane snapshot failed";
    res.status(500).json({ error: message });
  }
});

app.get("/api/forge/sovereign-posture", async (_req, res) => {
  try {
    const rows = await readAuditLog(projectRoot);
    const controlPlane = buildControlPlaneSnapshot({
      mode: sovereignMode,
      lockdown: governanceLockdown,
      policy: governancePolicy,
      telemetry: governanceTelemetry.getSummary(),
      approvalTokens: approvalTokens.getStats(),
      intents: intentVerifier.getStatus(),
      auditRows: rows
    });
    res.json(
      buildSovereignPosture({
        skiaStatus,
        ready: runtimeState.ready && !runtimeState.shuttingDown,
        mode: sovereignMode,
        lockdown: governanceLockdown,
        integration: {
          enabled: skiaFullAdapter.getStatus().enabled,
          brainOnly: skiaFullAdapter.getStatus().brainOnly
        },
        controlPlane
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sovereign posture snapshot failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/forge/control-plane/remediate", async (req, res) => {
  if (!verifySensitiveIntent(req, res, "forge.control_plane.remediate")) return;
  if (governanceLockdown) {
    return res.status(423).json({ status: "locked", error: "Governance lockdown is active." });
  }
  const parsed = controlPlaneRemediationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid remediation payload." });
  }
  const approvedViaToken =
    typeof parsed.data.approvalToken === "string"
      ? approvalTokens.consume(parsed.data.approvalToken, "remediation")
      : false;
  const approved = parsed.data.approved === true || approvedViaToken;
  if (!approved) {
    return res.status(403).json({
      status: "blocked",
      error: "Remediation requires explicit approval or valid approval token."
    });
  }
  const outcome = executeControlPlaneRemediation(parsed.data.action, sovereignMode, governancePolicy);
  sovereignMode = outcome.nextMode;
  await appendAuditLog(
    projectRoot,
    buildGovernanceAuditRecord({
      action: "forge.control_plane.remediate",
      mode: sovereignMode,
      approved: true,
      result: "success",
      details: `${parsed.data.action}: ${outcome.message}`
    })
  );
  persistAllState();
  return res.json({
    ok: true,
    action: parsed.data.action,
    applied: outcome.applied,
    mode: sovereignMode,
    message: outcome.message
  });
});

app.post("/api/forge/control-plane/remediate/recommended", async (_req, res) => {
  try {
    if (!verifySensitiveIntent(_req, res, "forge.control_plane.remediate.recommended")) return;
    if (governanceLockdown) {
      return res.status(423).json({ status: "locked", error: "Governance lockdown is active." });
    }
    const payload =
      typeof _req.body === "object" && _req.body ? (_req.body as Record<string, unknown>) : {};
    const approvedViaToken =
      typeof payload.approvalToken === "string"
        ? approvalTokens.consume(payload.approvalToken, "remediation")
        : false;
    const approved = payload.approved === true || approvedViaToken;
    if (!approved) {
      return res.status(403).json({
        status: "blocked",
        error: "Recommended remediation requires explicit approval or valid approval token."
      });
    }
    const rows = await readAuditLog(projectRoot);
    const snapshot = buildControlPlaneSnapshot({
      mode: sovereignMode,
      policy: governancePolicy,
      telemetry: governanceTelemetry.getSummary(),
      intents: intentVerifier.getStatus(),
      auditRows: rows
    });
    const execution = executeRecommendedRemediations(
      snapshot.recommendations,
      sovereignMode,
      governancePolicy
    );
    sovereignMode = execution.nextMode;
    for (const out of execution.outcomes) {
      await appendAuditLog(
        projectRoot,
        buildGovernanceAuditRecord({
          action: "forge.control_plane.remediate",
          mode: sovereignMode,
          approved: true,
          result: "success",
          details: `${out.action}: ${out.message}`
        })
      );
    }
    persistAllState();
    return res.json({
      ok: true,
      executed: execution.outcomes.length,
      mode: sovereignMode,
      outcomes: execution.outcomes
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recommended remediation failed";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/forge/governance/reload", async (_req, res) => {
  try {
    const rules = await loadSkiaRules(projectRoot);
    governancePolicy = buildGovernancePolicy(rules);
    sovereignMode = governancePolicy.defaultMode;
    governanceLockdown = false;
    persistAllState();
    return res.json({ ok: true, mode: sovereignMode, policy: governancePolicy });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Governance reload failed";
    return res.status(500).json({ error: message });
  }
});

app.post("/api/forge/module/:module/preview", (req, res) => {
  const moduleName = String(req.params.module || "");
  if (!isForgeModuleName(moduleName)) {
    return res.status(400).json({ error: "Unsupported forge module." });
  }
  const payload =
    typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
  const modeCandidate = typeof payload.mode === "string" ? payload.mode : sovereignMode;
  const mode: SovereignExecutionMode =
    modeCandidate === "strict" || modeCandidate === "adaptive" || modeCandidate === "autonomous"
      ? modeCandidate
      : sovereignMode;
  const approved = payload.approved === true;
  return res.json(previewModuleDecision(mode, moduleName, approved, governancePolicy));
});

async function enforceForgeModuleAccess(
  req: express.Request,
  res: express.Response,
  moduleName: ForgeModuleName
): Promise<{ mode: SovereignExecutionMode; approved: boolean } | null> {
  if (governanceLockdown) {
    res.status(423).json({
      module: moduleName,
      mode: sovereignMode,
      status: "locked",
      error: "Governance lockdown is active."
    });
    return null;
  }
  const { mode, approved, approvalToken } = resolveModeAndApproval(req.body, sovereignMode);
  const approvalViaToken =
    typeof approvalToken === "string" ? approvalTokens.consume(approvalToken, "module") : false;
  const effectiveApproved = approved || approvalViaToken;
  const decision = evaluateForgeModuleAccess(mode, moduleName, effectiveApproved, governancePolicy);
  governanceTelemetry.record(mode, moduleName, decision.allowed ? "allowed" : "blocked");
  persistAllState();
  if (!decision.allowed) {
    await appendAuditLog(
      projectRoot,
      buildGovernanceAuditRecord({
        action: "forge.module.decision",
        mode,
        approved: effectiveApproved,
        module: moduleName,
        result: "failure",
        details: decision.reason
      })
    );
    res.status(403).json({
      module: moduleName,
      mode,
      status: "blocked",
      error: decision.reason
    });
    return null;
  }
  return { mode, approved: effectiveApproved };
}

app.post("/index/rebuild", async (_req, res, next) => {
  try {
    skiaStatus = "Indexing";
    const started = Date.now();
    const index = await contextEngine.buildIndex();
    telemetry.record("index_build_duration_ms", Date.now() - started);
    skiaStatus = providerRouter.getStatus();
    runtimeState.ready = true;
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "index.rebuild",
      parameters: {},
      result: "success",
      details: `files=${index.files.length};chunks=${index.chunks.length}`
    });
    res.json({
      ok: true,
      files: index.files.length,
      chunks: index.chunks.length,
      generatedAt: index.generatedAt
    });
  } catch (error) {
    next(error);
  }
});

app.get("/chat", (_req, res) => {
  const releaseBase =
    process.env.SKIA_IDE_RELEASE_BASE_URL ??
    "https://github.com/AI-SKIA/skia/releases/latest/download";
  res.type("html").send(renderChatHtml(releaseBase));
});

app.get("/", (_req, res) => {
  res.redirect(302, SKIA_PLATFORM_DOWNLOADS_URL);
});

app.get("/forge", (_req, res) => {
  res.redirect(302, SKIA_PLATFORM_DOWNLOADS_URL);
});

const skiaIdeRendererRoot = path.join(projectRoot, "skia-ide", "dist", "renderer");
app.use("/forge/app", express.static(skiaIdeRendererRoot, { index: false, redirect: false }));

async function sendForgeAppHtml(res: express.Response) {
  const indexPath = path.join(skiaIdeRendererRoot, "index.html");
  try {
    const html = await fs.readFile(indexPath, "utf8");
    const browserShim = `
<link rel="icon" type="image/png" href="/favicon.png" />
<link rel="apple-touch-icon" href="/favicon.png" />
<script>
  (function () {
    if (window.skiaElectron) return;
    const webModeStatus = "WEB MODE: API features enabled | local desktop actions adapted";
    const unsupported = "Desktop-only action is unavailable in browser mode.";
    const listeners = {
      backendLog: [],
      statusUpdate: [],
      menuAction: new Map()
    };
    const fileStore = new Map();
    let activeWorkspaceRoot = "browser-workspace";

    function fireStatus(text) {
      listeners.statusUpdate.forEach(function (cb) {
        try { cb(text); } catch {}
      });
    }
    function fireBackendLog(line) {
      listeners.backendLog.forEach(function (cb) {
        try { cb(line); } catch {}
      });
    }
    function basename(p) {
      var parts = String(p || "").replace(/\\\\/g, "/").split("/");
      return parts[parts.length - 1] || "file.txt";
    }
    function triggerDownload(name, text) {
      var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = name || "skia-file.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    function pickFiles(opts) {
      return new Promise(function (resolve) {
        var input = document.createElement("input");
        input.type = "file";
        if (opts && opts.multiple) input.multiple = true;
        if (opts && opts.directory) {
          input.setAttribute("webkitdirectory", "");
          input.setAttribute("directory", "");
          input.multiple = true;
        }
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = function () {
          var arr = Array.from(input.files || []);
          document.body.removeChild(input);
          resolve(arr);
        };
        input.click();
      });
    }
    function node(name, path, type) {
      return { name: name, path: path, type: type, children: type === "directory" ? [] : undefined };
    }
    function buildTree(root) {
      var rootNode = node(root, root, "directory");
      var dirs = new Map();
      dirs.set(root, rootNode);
      Array.from(fileStore.keys()).forEach(function (fullPath) {
        if (!String(fullPath).startsWith(root + "/")) return;
        var rel = String(fullPath).slice((root + "/").length);
        var parts = rel.split("/").filter(Boolean);
        var parentPath = root;
        var parent = dirs.get(parentPath);
        for (var i = 0; i < parts.length; i += 1) {
          var seg = parts[i];
          var isLast = i === parts.length - 1;
          var currentPath = parentPath + "/" + seg;
          if (isLast) {
            parent.children.push(node(seg, currentPath, "file"));
          } else {
            var existing = dirs.get(currentPath);
            if (!existing) {
              existing = node(seg, currentPath, "directory");
              dirs.set(currentPath, existing);
              parent.children.push(existing);
            }
            parent = existing;
            parentPath = currentPath;
          }
        }
      });
      function sortNodes(items) {
        items.sort(function (a, b) {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        items.forEach(function (it) {
          if (it.children) sortNodes(it.children);
        });
      }
      sortNodes(rootNode.children);
      return rootNode.children;
    }

    function registerMenuAction(channel, listener) {
      if (!listeners.menuAction.has(channel)) listeners.menuAction.set(channel, []);
      listeners.menuAction.get(channel).push(listener);
      return function () {
        var arr = listeners.menuAction.get(channel) || [];
        listeners.menuAction.set(channel, arr.filter(function (x) { return x !== listener; }));
      };
    }

    window.skiaElectron = {
      getConfig: async function () {
        return { backendUrl: window.location.origin, authToken: "", timeout: 15000 };
      },
      openFolder: async function () {
        var files = await pickFiles({ directory: true });
        if (!files.length) return null;
        activeWorkspaceRoot = "browser-project";
        fileStore.clear();
        await Promise.all(files.map(async function (f) {
          var rel = f.webkitRelativePath || f.name;
          var content = await f.text();
          fileStore.set(activeWorkspaceRoot + "/" + rel.replace(/\\\\/g, "/"), content);
        }));
        fireBackendLog("WEB MODE: imported " + String(files.length) + " file(s) from folder picker.");
        fireStatus(webModeStatus);
        return activeWorkspaceRoot;
      },
      openFile: async function () {
        var files = await pickFiles({ multiple: false });
        if (!files.length) return null;
        var f = files[0];
        var content = await f.text();
        activeWorkspaceRoot = "browser-workspace";
        var full = activeWorkspaceRoot + "/" + f.name;
        fileStore.set(full, content);
        fireBackendLog("WEB MODE: opened file " + f.name + ".");
        fireStatus(webModeStatus);
        return full;
      },
      saveFile: async function (filePath, content) {
        if (!filePath) return false;
        fileStore.set(String(filePath), String(content ?? ""));
        triggerDownload(basename(filePath), String(content ?? ""));
        fireBackendLog("WEB MODE: downloaded " + basename(filePath) + ".");
        return true;
      },
      saveFileAs: async function (content) {
        var name = window.prompt("Save as filename", "skia-file.txt");
        if (!name) return null;
        var full = activeWorkspaceRoot + "/" + name;
        fileStore.set(full, String(content ?? ""));
        triggerDownload(name, String(content ?? ""));
        fireBackendLog("WEB MODE: downloaded " + name + ".");
        return full;
      },
      readFileText: async function (filePath) {
        if (!fileStore.has(String(filePath))) throw new Error("File not loaded in web workspace.");
        return fileStore.get(String(filePath)) || "";
      },
      readDirectoryTree: async function (folderPath) {
        return buildTree(String(folderPath || activeWorkspaceRoot));
      },
      onMenuAction: registerMenuAction,
      onBackendLog: function (listener) {
        listeners.backendLog.push(listener);
        setTimeout(function () { try { listener("WEB MODE: desktop menu/IPC unavailable; using browser-safe flows."); } catch {} }, 0);
        return function () {
          listeners.backendLog = listeners.backendLog.filter(function (x) { return x !== listener; });
        };
      },
      onStatusUpdate: function (listener) {
        listeners.statusUpdate.push(listener);
        setTimeout(function () { try { listener(webModeStatus); } catch {} }, 0);
        return function () {
          listeners.statusUpdate = listeners.statusUpdate.filter(function (x) { return x !== listener; });
        };
      },
      runCommand: async function () { return { stdout: "", stderr: unsupported }; },
      setAutoSave: function () {},
      openDocs: function () { window.open("/docs/README.md", "_blank", "noopener"); },
      getCookies: async function () { return []; },
      openExternal: function (url) { if (typeof url === "string" && url) window.open(url, "_blank", "noopener"); }
    };
    fireStatus(webModeStatus);
  })();
</script>`;
    const withShim = html.includes("</head>")
      ? html.replace("</head>", `${browserShim}\n</head>`)
      : `${browserShim}\n${html}`;
    res.type("html").send(withShim);
  } catch {
    res.status(503).type("html").send(
      "<!doctype html><html><body style='font-family:Arial;background:#080400;color:#d4af37;padding:24px'>SKIA IDE web assets are not built yet. Run <code>npm run build</code> in <code>skia-ide</code> first.</body></html>"
    );
  }
}

app.get("/forge/app", async (_req, res) => {
  await sendForgeAppHtml(res);
});

app.get("/forge/app/", async (_req, res) => {
  await sendForgeAppHtml(res);
});

app.get("/download", (_req, res) => {
  res.redirect(302, SKIA_PLATFORM_DOWNLOADS_URL);
});

app.get("/favicon.png", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public", "skia-forge-favicon.png"));
});

app.get("/favicon.ico", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public", "favicon.ico"));
});

app.get("/og/skia-forge-preview.svg", (_req, res) => {
  res.type("image/svg+xml").send(renderOgImageSvg());
});

app.get("/forge/platform", (_req, res) => {
  res.type("html").send(renderForgePlatformHtml());
});

// Serve branded HTML doc pages (public/docs/) before raw markdown
app.use("/docs", express.static(path.join(projectRoot, "public", "docs")));
// Fallback: raw .md files
app.use("/docs", express.static(path.join(projectRoot, "docs")));

app.get("/resources", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public", "resources.html"));
});

app.get("/security", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public", "security.html"));
});

app.get("/contact", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public", "contact.html"));
});

app.post("/diff/preview", (req, res) => {
  const oldText = String(req.body?.oldText ?? "");
  const newText = String(req.body?.newText ?? "");
  const oldSize = enforceTextSize(oldText, 150_000);
  if (!oldSize.ok) {
    return res.status(413).json({ error: oldSize.error });
  }
  const newSize = enforceTextSize(newText, 150_000);
  if (!newSize.ok) {
    return res.status(413).json({ error: newSize.error });
  }
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  const max = Math.max(oldLines.length, newLines.length);
  const lines: Array<{ type: "context" | "add" | "remove"; text: string }> = [];
  for (let i = 0; i < max; i += 1) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) {
      lines.push({ type: "context", text: oldLine ?? "" });
      continue;
    }
    if (oldLine !== undefined) {
      lines.push({ type: "remove", text: oldLine });
    }
    if (newLine !== undefined) {
      lines.push({ type: "add", text: newLine });
    }
  }
  res.json({ lines });
});

app.get("/providers/status", (_req, res) => {
  const activeProvider = providerRouter.routeForTask("chat");
  skiaStatus = providerRouter.getStatus();
  res.json({
    status: skiaStatus,
    activeProvider,
    providers: providerRouter.getHealth()
  });
});

app.post("/providers/health", (req, res) => {
  const parsed = providerHealthSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid provider health payload." });
  }
  providerRouter.setProviderHealth(parsed.data.name, parsed.data.healthy, parsed.data.latencyMs);
  skiaStatus = providerRouter.getStatus();
  persistAllState();
  res.json({ ok: true, status: skiaStatus, providers: providerRouter.getHealth() });
});

app.post("/providers/force", (req, res) => {
  const parsed = providerForceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid provider force payload." });
  }
  const name = parsed.data.name ?? null;
  if (name === "gemini" || name === "skia") {
    providerRouter.forceProvider(name);
  } else {
    providerRouter.forceProvider(null);
  }
  skiaStatus = providerRouter.getStatus();
  persistAllState();
  res.json({ ok: true, forced: name ?? null, status: skiaStatus });
});

app.post("/telemetry/record", (req, res) => {
  const parsed = telemetryRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid telemetry payload." });
  }
  telemetry.record(parsed.data.metric, parsed.data.value);
  persistAllState();
  return res.json({ ok: true });
});

app.get("/telemetry/summary", (_req, res) => {
  res.json(telemetry.getSummary());
});

app.get("/index", async (_req, res, next) => {
  try {
    const index = await contextEngine.getIndex();
    res.json(index);
  } catch (error) {
    next(error);
  }
});

app.get("/search", async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "").trim();
    const topK = Number(req.query.k ?? 10);
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter q." });
    }
    const results = await contextEngine.search(query, Number.isFinite(topK) ? topK : 10);
    return res.json({
      query,
      count: results.length,
      results
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/rules", async (_req, res, next) => {
  try {
    const rules = await loadSkiaRules(projectRoot);
    res.json(rules);
  } catch (error) {
    next(error);
  }
});

app.get("/agent/audit-log", async (_req, res, next) => {
  try {
    const rows = await readAuditLog(projectRoot);
    res.json({ count: rows.length, rows });
  } catch (error) {
    next(error);
  }
});

app.post("/agent/log", async (req, res, next) => {
  try {
    const action = String(req.body?.action ?? "").trim();
    if (!action) {
      return res.status(400).json({ error: "Missing action in body." });
    }
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action,
      parameters: typeof req.body?.parameters === "object" ? req.body.parameters : {},
      result: req.body?.result === "failure" ? "failure" : "success",
      details: typeof req.body?.details === "string" ? req.body.details : undefined
    });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.post("/agent/validate-command", async (req, res, next) => {
  try {
    const parsed = validateCommandSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid validate-command payload." });
    }
    const command = parsed.data.command;
    const verdict = evaluateCommandSafety(command);
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "agent.validate_command",
      parameters: { command },
      result: verdict.allowed ? "success" : "failure",
      details: verdict.reason
    });
    res.json(verdict);
  } catch (error) {
    next(error);
  }
});

app.post("/rpc", rateLimitMiddleware(rpcLimiter), async (req, res, next) => {
  try {
    const serialized = JSON.stringify(req.body ?? {});
    const payloadSize = enforceTextSize(serialized, 250_000);
    if (!payloadSize.ok) {
      return res.status(413).json({ error: payloadSize.error });
    }
    const response = await handleRpcRequest(projectRoot, contextEngine, req.body, skiaFullAdapter);
    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/sovereign-core", async (req, res) => {
  try {
    const upstream = await skiaFullAdapter.sovereignCore(
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {},
      pickSkiaHeaders(req)
    );
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sovereign core call failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/integration/skia-full/route", async (req, res) => {
  try {
    const query = String(req.body?.query ?? "");
    const intent = typeof req.body?.intent === "string" ? req.body.intent : undefined;
    if (!query.trim()) {
      return res.status(400).json({ error: "query is required" });
    }
    const upstream = await skiaFullAdapter.routeReasoning(query, intent, pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SKIA-FULL route call failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/integration/skia-full/routing-estimate", async (req, res) => {
  try {
    const payload =
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
    const upstream = await skiaFullAdapter.routingEstimate(payload, pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SKIA-FULL routing estimate failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/integration/skia-full/chat", async (req, res) => {
  try {
    const message = String(req.body?.message ?? req.body?.query ?? "");
    const mode = typeof req.body?.mode === "string" ? req.body.mode : undefined;
    if (!message.trim()) {
      return res.status(400).json({ error: "message is required" });
    }
    const upstream = await skiaFullAdapter.intelligence(message, mode, pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SKIA-FULL chat call failed";
    return res.status(502).json({ error: message });
  }
});

// Forge platform surface: these endpoints orchestrate through existing SKIA brain services.
app.post("/api/forge/context", async (req, res) => {
  try {
    const access = await enforceForgeModuleAccess(req, res, "context");
    if (!access) return;
    const query = String(req.body?.query ?? req.body?.prompt ?? "");
    if (!query.trim()) return res.status(400).json({ error: "query is required" });
    const upstream = await skiaFullAdapter.routeReasoning(query, "context", pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge context failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/forge/agent", async (req, res) => {
  try {
    const access = await enforceForgeModuleAccess(req, res, "agent");
    if (!access) return;
    const instruction = String(
      req.body?.instruction ?? req.body?.query ?? req.body?.message ?? ""
    );
    if (!instruction.trim()) return res.status(400).json({ error: "instruction is required" });
    const upstream = await skiaFullAdapter.intelligence(instruction, "agent", pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge agent failed";
    return res.status(502).json({ error: message });
  }
});

/** D1-08: structured plan — D1-07 context + SKIA chat; does not run executor/tools. */
app.post("/api/forge/agent/plan", async (req, res) => {
  const parsed = forgeAgentPlanRequestSchema.safeParse(
    req.body && typeof req.body === "object" ? req.body : {}
  );
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid body: { goal, path, contextQuery?, maxTokens?, topK?, nprobes?, refineFactor?, where?, bypassVectorIndex? }"
    });
  }
  const access = await enforceForgeModuleAccess(req, res, "agent");
  if (!access) {
    return;
  }
  const d = parsed.data;
  const { status, body } = await runAgentPlannerRequest(
    projectRoot,
    {
      goal: d.goal,
      path: d.path,
      contextQuery: d.contextQuery,
      maxTokens: d.maxTokens,
      topK: d.topK,
      nprobes: d.nprobes,
      refineFactor: d.refineFactor,
      where: d.where,
      bypassVectorIndex: d.bypassVectorIndex,
      resilientRetrieval: d.resilientRetrieval
    },
    skiaFullAdapter,
    process.env,
    contextEngine,
    pickSkiaHeaders(req),
    {
      getSkiarulesConfig: () => contextEngine.getSkiarulesConfig(),
      getDiagnosticsForPath: (rel) => contextEngine.getDiagnosticsForPath(rel),
      getLspSkiarulesBundleForPath: (rel) => contextEngine.getLspSkiarulesBundleForPath(rel)
    }
  );
  return res.status(status).json(body);
});

/** D1-10: run v1 plan + tool steps with preview/apply, gating, and audit to `.skia/agent-log.json`. */
app.post("/api/forge/agent/execute", async (req, res) => {
  const access = await enforceForgeModuleAccess(req, res, "agent");
  if (!access) {
    return;
  }
  const { status, body } = await runAgentExecutorRequest(
    projectRoot,
    req.body && typeof req.body === "object" ? req.body : {},
    {
      skia: skiaFullAdapter,
      getSkiarulesConfig: () => contextEngine.getSkiarulesConfig(),
      pickPassthroughHeaders: (r) => pickSkiaHeaders(r as express.Request),
      expressReq: req
    }
  );
  return res.status(status).json(body);
});

app.post("/api/forge/sdlc", async (req, res) => {
  try {
    const access = await enforceForgeModuleAccess(req, res, "sdlc");
    if (!access) return;
    const prompt = String(req.body?.prompt ?? req.body?.intent ?? "");
    if (!prompt.trim()) return res.status(400).json({ error: "prompt is required" });
    const upstream = await skiaFullAdapter.intelligence(prompt, "sdlc", pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge SDLC failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/forge/production", async (req, res) => {
  try {
    const access = await enforceForgeModuleAccess(req, res, "production");
    if (!access) return;
    const payload =
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
    const upstream = await skiaFullAdapter.routingEstimate(payload, pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge production failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/forge/healing", async (req, res) => {
  try {
    const access = await enforceForgeModuleAccess(req, res, "healing");
    if (!access) return;
    const incident = String(req.body?.incident ?? req.body?.query ?? "");
    if (!incident.trim()) return res.status(400).json({ error: "incident is required" });
    const upstream = await skiaFullAdapter.routeReasoning(incident, "healing", pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge healing failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/forge/architecture", async (req, res) => {
  try {
    const access = await enforceForgeModuleAccess(req, res, "architecture");
    if (!access) return;
    const query = String(req.body?.query ?? req.body?.prompt ?? "");
    if (!query.trim()) return res.status(400).json({ error: "query is required" });
    const upstream = await skiaFullAdapter.routeReasoning(query, "architecture", pickSkiaHeaders(req));
    return res.json(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge architecture failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/forge/module/:module", async (req, res) => {
  try {
    const moduleName = String(req.params.module || "");
    if (!isForgeModuleName(moduleName)) {
      return res.status(400).json({ error: "Unsupported forge module." });
    }
    const access = await enforceForgeModuleAccess(req, res, moduleName);
    if (!access) return;
    const payload =
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
    const { mode, approved } = access;
    const result = await runForgeModule(skiaFullAdapter, moduleName, payload, pickSkiaHeaders(req));
    await appendAuditLog(
      projectRoot,
      buildGovernanceAuditRecord({
        action: "forge.module.execute",
        mode,
        approved,
        module: moduleName,
        result: "success",
        details: "Forge module execution completed."
      })
    );
    return res.json({ module: moduleName, mode, status: "success", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge module execution failed";
    const payload =
      typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};
    const modeCandidate = typeof payload.mode === "string" ? payload.mode : sovereignMode;
    const mode: SovereignExecutionMode =
      modeCandidate === "strict" || modeCandidate === "adaptive" || modeCandidate === "autonomous"
        ? modeCandidate
        : sovereignMode;
    const approved = payload.approved === true;
    const moduleName = String(req.params.module || "");
    await appendAuditLog(
      projectRoot,
      buildGovernanceAuditRecord({
        action: "forge.module.execute",
        mode,
        approved,
        module: isForgeModuleName(moduleName) ? moduleName : undefined,
        result: "failure",
        details: message
      })
    );
    return res.status(502).json({ status: "failed", error: message });
  }
});

app.post("/api/forge/orchestrate", async (req, res) => {
  try {
    if (governanceLockdown) {
      return res.status(423).json({ status: "locked", error: "Governance lockdown is active." });
    }
    const intent = String(req.body?.intent ?? req.body?.query ?? "");
    if (!intent.trim()) return res.status(400).json({ error: "intent is required" });
    const approvalResolution = resolveModeAndApproval(req.body, sovereignMode);
    const approvalViaToken =
      typeof approvalResolution.approvalToken === "string"
        ? approvalTokens.consume(approvalResolution.approvalToken, "orchestration")
        : false;
    const approved = approvalResolution.approved || approvalViaToken;
    const includeHealing = req.body?.includeHealing !== false;
    const productionPayload =
      typeof req.body?.productionPayload === "object" && req.body?.productionPayload
        ? (req.body.productionPayload as Record<string, unknown>)
        : undefined;
    const mode = approvalResolution.mode;
    const out = await runForgeOrchestration(
      skiaFullAdapter,
      {
        intent,
        includeHealing,
        productionPayload,
        mode,
        approved,
        policy: governancePolicy,
        onStageDecision: (stage, decision, decisionMode) => {
          governanceTelemetry.record(decisionMode, stage, decision);
        }
      },
      pickSkiaHeaders(req)
    );
    await appendAuditLog(
      projectRoot,
      buildGovernanceAuditRecord({
        action: "forge.orchestration.execute",
        mode,
        approved,
        result: out.status === "failed" ? "failure" : "success",
        details: `status=${out.status};success=${out.summary.successCount};failed=${out.summary.failedCount}`,
        extra: { intent }
      })
    );
    if (out.status === "success") {
      return res.status(200).json(out);
    }
    if (out.status === "partial_success") {
      return res.status(207).json(out);
    }
    return res.status(502).json(out);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forge orchestrate failed";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/forge/orchestrate/preview", (req, res) => {
  if (governanceLockdown) {
    return res.status(423).json({ status: "locked", error: "Governance lockdown is active." });
  }
  const mode =
    req.body?.mode === "strict" || req.body?.mode === "adaptive" || req.body?.mode === "autonomous"
      ? (req.body.mode as SovereignExecutionMode)
      : sovereignMode;
  const approved = req.body?.approved === true;
  const includeHealing = req.body?.includeHealing !== false;
  return res.json(previewOrchestrationDecisions(mode, approved, includeHealing, governancePolicy));
});

function pickSkiaHeaders(req: express.Request): Record<string, string> {
  const out: Record<string, string> = {};
  const auth = req.headers.authorization;
  const cookie = req.headers.cookie;
  const apiKey = req.headers["x-api-key"];
  if (typeof auth === "string") out.authorization = auth;
  if (typeof cookie === "string") out.cookie = cookie;
  if (typeof apiKey === "string") out["x-api-key"] = apiKey;
  return out;
}

function verifySensitiveIntent(
  req: express.Request,
  res: express.Response,
  intent: SensitiveIntentName
): boolean {
  const signature =
    typeof req.headers["x-skia-intent-signature"] === "string"
      ? req.headers["x-skia-intent-signature"]
      : undefined;
  const timestamp =
    typeof req.headers["x-skia-intent-ts"] === "string" ? req.headers["x-skia-intent-ts"] : undefined;
  const nonce =
    typeof req.headers["x-skia-intent-nonce"] === "string"
      ? req.headers["x-skia-intent-nonce"]
      : undefined;
  const verdict = intentVerifier.verifyIntent({
    intent,
    payload: req.body,
    signature,
    timestamp,
    nonce
  });
  if (verdict.ok) {
    return true;
  }
  res.status(401).json({ status: "blocked", error: verdict.reason });
  return false;
}

app.get("/stream/:method", rateLimitMiddleware(streamLimiter), (req, res) => {
  const method = String(req.params.method || "");
  const serializedParams = String(req.query.params ?? "{}");
  const size = enforceTextSize(serializedParams, 75_000);
  if (!size.ok) {
    return res.status(413).json({ error: size.error });
  }
  let params: Record<string, unknown> = {};
  try {
    params = JSON.parse(serializedParams) as Record<string, unknown>;
  } catch {
    // Keep defaults if params are malformed.
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const chunks = streamSkiaMethod(method, params);
  let index = 0;
  const interval = setInterval(() => {
    if (index >= chunks.length) {
      res.write("event: done\ndata: [DONE]\n\n");
      clearInterval(interval);
      res.end();
      return;
    }
    res.write(`event: token\ndata: ${JSON.stringify({ token: chunks[index] })}\n\n`);
    index += 1;
  }, 120);

  req.on("close", () => {
    clearInterval(interval);
  });
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const requestId = (req as RequestWithContext).requestId ?? "unknown";
  console.error(
    JSON.stringify({
      level: "error",
      event: "http.error",
      requestId,
      message
    })
  );
  res.status(500).json({ error: message, requestId });
});

const port = Number(process.env.SKIA_PORT ?? 4173);
const server = http.createServer(app);
attachInlineCompletionServer(server, providerRouter, () => skiaStatus);
server.listen(port, () => {
  // Intentional startup log to simplify local diagnostics.
  console.log(`SKIA Intelligence listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  if (runtimeState.shuttingDown) {
    return;
  }
  runtimeState.shuttingDown = true;
  runtimeState.ready = false;
  try {
    await contextEngine.stopIncrementalWatcher();
  } catch {
    // Best-effort shutdown path.
  }
  try {
    await persistRuntimeState(projectRoot, providerRouter, telemetry, {
      getMode: () => sovereignMode,
      getLockdown: () => governanceLockdown,
      governanceTelemetry
    });
  } catch {
    // Best-effort shutdown path.
  }
  server.close(() => {
    console.log(`SKIA Intelligence shutdown complete (${signal})`);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

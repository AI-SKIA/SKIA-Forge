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
import { renderDownloadHtml } from "./downloadUi.js";
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

function persistAllState(): void {
  void persistRuntimeState(projectRoot, providerRouter, telemetry, {
    getMode: () => sovereignMode,
    getLockdown: () => governanceLockdown,
    governanceTelemetry
  });
}

void contextEngine.startIncrementalWatcher(
  () => {
    skiaStatus = providerRouter.getStatus();
  },
  embedSaveHook
);

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
  res.type("html").send(renderChatHtml());
});

app.get("/", (_req, res) => {
  const releaseBase =
    process.env.SKIA_IDE_RELEASE_BASE_URL ??
    "https://github.com/AI-SKIA/skia/releases/latest/download";
  res.type("html").send(renderDownloadHtml(releaseBase));
});

app.get("/download", (_req, res) => {
  const releaseBase =
    process.env.SKIA_IDE_RELEASE_BASE_URL ??
    "https://github.com/AI-SKIA/skia/releases/latest/download";
  res.type("html").send(renderDownloadHtml(releaseBase));
});

app.get("/favicon.png", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public", "skia-forge-favicon.png"));
});

app.get("/og/skia-forge-preview.svg", (_req, res) => {
  res.type("image/svg+xml").send(renderOgImageSvg());
});

app.get("/forge/platform", (_req, res) => {
  res.type("html").send(renderForgePlatformHtml());
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

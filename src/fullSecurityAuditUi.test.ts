import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isFullSecurityAuditUiEnabled } from "./fullSecurityAuditUiFlag.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("FORGE_FULL_SECURITY_AUDIT_UI defaults false (dark)", () => {
  assert.equal(isFullSecurityAuditUiEnabled({}), false);
  assert.equal(isFullSecurityAuditUiEnabled({ FORGE_FULL_SECURITY_AUDIT_UI: undefined }), false);
  assert.equal(isFullSecurityAuditUiEnabled({ FORGE_FULL_SECURITY_AUDIT_UI: "false" }), false);
  assert.equal(isFullSecurityAuditUiEnabled({ FORGE_FULL_SECURITY_AUDIT_UI: "1" }), false);
  assert.equal(isFullSecurityAuditUiEnabled({ FORGE_FULL_SECURITY_AUDIT_UI: "true" }), true);
});

test("modules/status serves fullSecurityAuditUi from server helper (not client storage)", () => {
  const serverSrc = fs.readFileSync(path.join(root, "src/server.ts"), "utf8");
  assert.ok(serverSrc.includes("fullSecurityAuditUi: isFullSecurityAuditUiEnabled()"));
  assert.ok(serverSrc.includes('app.get("/api/forge/modules/status"'));
  assert.ok(!serverSrc.includes("localStorage"));
  const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  assert.ok(envExample.includes("FORGE_FULL_SECURITY_AUDIT_UI=false"));
});

test("full-audit v1 ignores webUrl (local project only)", () => {
  const serverSrc = fs.readFileSync(path.join(root, "src/server.ts"), "utf8");
  assert.ok(serverSrc.includes('app.post("/api/forge/security/full-audit"'));
  assert.ok(/webUrl intentionally ignored/.test(serverSrc));
  assert.ok(
    /runFullAuditFromBrain\(\s*projectRoot,\s*skiaFullAdapter,\s*pickSkiaHeaders\(req\),\s*undefined\s*\)/.test(
      serverSrc
    )
  );
  const apiClient = fs.readFileSync(
    path.join(root, "skia-ide/src/renderer/skia/skiaApiClient.ts"),
    "utf8"
  );
  assert.ok(apiClient.includes("runFullSecurityAudit"));
  assert.ok(apiClient.includes("body: JSON.stringify({})"));
  assert.ok(!/runFullSecurityAudit[\s\S]*webUrl/.test(apiClient));
});

test("flag off: menu item gated; flag on path exists behind fullSecurityAuditUiEnabled", () => {
  const mainSrc = fs.readFileSync(path.join(root, "skia-ide/src/main/main.ts"), "utf8");
  assert.ok(mainSrc.includes("let fullSecurityAuditUiEnabled = false"));
  assert.ok(mainSrc.includes("if (fullSecurityAuditUiEnabled)"));
  assert.ok(mainSrc.includes("L.fullSecurityAudit"));
  assert.ok(mainSrc.includes('send("run-full-security-audit")'));
  assert.ok(mainSrc.includes('ipcMain.handle("skia:setFullSecurityAuditMenu"'));
  const idx = mainSrc.indexOf("L.fullSecurityAudit");
  const before = mainSrc.slice(Math.max(0, idx - 200), idx);
  assert.ok(before.includes("fullSecurityAuditUiEnabled"), "menu label must be behind the flag gate");
});

test("renderer syncs flag from modules/status and writes results to skiaAgentPanel #agent-log", () => {
  const indexSrc = fs.readFileSync(path.join(root, "skia-ide/src/renderer/index.ts"), "utf8");
  assert.ok(indexSrc.includes("fullSecurityAuditUi"));
  assert.ok(indexSrc.includes("setFullSecurityAuditMenu"));
  assert.ok(indexSrc.includes('onMenuAction("run-full-security-audit"'));
  assert.ok(indexSrc.includes("appendFullSecurityAuditToAgentLog"));
  assert.ok(!/fullSecurityAuditUi[\s\S]{0,120}localStorage/.test(indexSrc));
  const panelSrc = fs.readFileSync(
    path.join(root, "skia-ide/src/renderer/skia/skiaAgentPanel.ts"),
    "utf8"
  );
  assert.ok(panelSrc.includes("appendFullSecurityAuditToAgentLog"));
  assert.ok(panelSrc.includes('getElementById("agent-log")'));
  const preloadSrc = fs.readFileSync(path.join(root, "skia-ide/src/main/preload.ts"), "utf8");
  assert.ok(preloadSrc.includes("setFullSecurityAuditMenu"));
});

test("all 12 menu locales include fullSecurityAudit label", () => {
  const menuSrc = fs.readFileSync(path.join(root, "skia-ide/src/main/menuLocales.ts"), "utf8");
  const locales = [
    "en",
    "fr",
    "es",
    "ar",
    "zh",
    "pt",
    "de",
    "ja",
    "ko",
    "hi",
    "tr",
    "ru",
  ];
  assert.equal(locales.length, 12);
  const matches = menuSrc.match(/fullSecurityAudit:\s*"[^"]+"/g) ?? [];
  assert.ok(matches.length >= 12, `expected ≥12 fullSecurityAudit labels, got ${matches.length}`);
  for (const m of matches) {
    assert.ok(/fullSecurityAudit:\s*".+"/.test(m));
  }
});

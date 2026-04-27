import assert from "node:assert/strict";
import test from "node:test";
import { renderForgePlatformHtml } from "./forgePlatformUi.js";

test("forge platform html includes brand and core web IDE routes", () => {
  const html = renderForgePlatformHtml();
  assert.ok(html.includes("SKIA FORGE IDE"));
  assert.ok(html.includes("Forge Web IDE"));
  assert.ok(html.includes("/api/forge/orchestrate"));
  assert.ok(html.includes("/api/forge/module/"));
  assert.ok(html.includes("/api/forge/modules/status"));
  assert.ok(html.includes("/integration/skia-full"));
  assert.ok(html.includes("/api/forge/mode"));
  assert.ok(html.includes("Download App"));
  assert.ok(html.includes("#d4af37"));
});
